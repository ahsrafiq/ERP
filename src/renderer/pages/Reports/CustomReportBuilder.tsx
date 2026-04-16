import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message, Badge } from 'antd';
import { PlusOutlined, SaveOutlined, FilterOutlined, ReloadOutlined, DeleteOutlined, FolderOpenOutlined, ArrowRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

type ModuleKey = 'sales' | 'purchases' | 'inventory' | 'payments';

type FieldType = 'string' | 'number' | 'date' | 'enum';

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  filterable?: boolean;
  columnVisibleByDefault?: boolean;
};

type UnifiedRow = Record<string, any> & { __module: ModuleKey; __type: string };

type FilterDef = {
  id: string;
  fieldKey: string;
  operator: string;
  value?: any;
  from?: any;
  to?: any;
};

type TemplateConfig = {
  module: ModuleKey;
  dataFocus?: string;
  columns: string[];
  filters: FilterDef[];
};

const MODULES: Array<{ key: ModuleKey; label: string; color: string }> = [
  { key: 'sales', label: 'Sales', color: '#1890ff' },
  { key: 'purchases', label: 'Purchases', color: '#52c41a' },
  { key: 'inventory', label: 'Inventory', color: '#faad14' },
  { key: 'payments', label: 'Payments & Receipts', color: '#722ed1' },
];

const FIELDS_BY_MODULE: Record<ModuleKey, FieldDef[]> = {
  sales: [
    { key: '__type', label: 'Doc Type', type: 'enum', filterable: true, columnVisibleByDefault: true },
    { key: 'number', label: 'Number', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'date', label: 'Date', type: 'date', filterable: true, columnVisibleByDefault: true },
    { key: 'customer', label: 'Customer', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'po_number', label: 'PO #', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'total', label: 'Amount', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'balance', label: 'Balance', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'status', label: 'Status', type: 'enum', filterable: true, columnVisibleByDefault: true },
  ],
  purchases: [
    { key: 'number', label: 'Invoice #', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'date', label: 'Date', type: 'date', filterable: true, columnVisibleByDefault: true },
    { key: 'vendor', label: 'Vendor', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'total', label: 'Amount', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'balance', label: 'Balance', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'status', label: 'Status', type: 'enum', filterable: true, columnVisibleByDefault: true },
  ],
  inventory: [
    { key: 'code', label: 'Item Code', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'name', label: 'Name', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'brand', label: 'Brand', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'category', label: 'Category', type: 'string', filterable: true },
    { key: 'quantity', label: 'Stock', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'purchase_price', label: 'Purch. Price', type: 'number', filterable: true },
    { key: 'sell_price', label: 'Sell Price', type: 'number', filterable: true, columnVisibleByDefault: true },
  ],
  payments: [
    { key: 'number', label: 'Voucher #', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'date', label: 'Date', type: 'date', filterable: true, columnVisibleByDefault: true },
    { key: 'type', label: 'Type', type: 'enum', filterable: true, columnVisibleByDefault: true },
    { key: 'party', label: 'Party (Cust/Vend)', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'amount', label: 'Amount', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'method', label: 'Method', type: 'string', filterable: true, columnVisibleByDefault: true },
  ],
};

const CustomReportBuilder: React.FC = () => {
  const { currentCompany } = useApp();
  const [moduleKey, setModuleKey] = useState<ModuleKey>('sales');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [allRows, setAllRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [dataFocus, setDataFocus] = useState<string>('all');

  const FOCAL_OPTIONS: Record<ModuleKey, Array<{ label: string; value: string }>> = {
    sales: [
      { label: 'All Sales', value: 'all' },
      { label: 'Invoices Only', value: 'invoices' },
      { label: 'Quotations Only', value: 'quotations' },
      { label: 'Challans (DC) Only', value: 'challans' },
    ],
    payments: [
      { label: 'All Payments', value: 'all' },
      { label: 'Receipts (IN) Only', value: 'in' },
      { label: 'Payments (OUT) Only', value: 'out' },
    ],
    purchases: [{ label: 'All Purchases', value: 'all' }],
    inventory: [{ label: 'All Inventory', value: 'all' }],
  };

  // Filter builders state
  const [pendingFilterField, setPendingFilterField] = useState<string>('');
  const [pendingOperator, setPendingOperator] = useState<string>('contains');
  const [pendingValue, setPendingValue] = useState<any>(undefined);
  const [pendingFrom, setPendingFrom] = useState<any>(undefined);
  const [pendingTo, setPendingTo] = useState<any>(undefined);

  const fields = useMemo(() => FIELDS_BY_MODULE[moduleKey], [moduleKey]);
  const filterableFields = useMemo(() => fields.filter(f => f.filterable), [fields]);
  const selectedFieldDef = useMemo(() => fields.find(f => f.key === pendingFilterField), [fields, pendingFilterField]);

  // Default columns when module changes
  useEffect(() => {
    const defaults = fields.filter(f => f.columnVisibleByDefault).map(f => f.key);
    setSelectedColumns(defaults);
    setFilters([]);
    setPendingFilterField('');
    setDataFocus('all'); // Reset focus when module changes
  }, [moduleKey, fields]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const db = (window as any).electronAPI.db;
      let rows: UnifiedRow[] = [];

      if (moduleKey === 'sales') {
        let invoices: any[] = [];
        let quotations: any[] = [];
        let challans: any[] = [];

        if (dataFocus === 'all' || dataFocus === 'invoices') {
          const res = await db.salesInvoices.getAll(currentCompany.id);
          invoices = (res?.success ? res.data : res) || [];
        }
        if (dataFocus === 'all' || dataFocus === 'quotations') {
          const res = await db.salesQuotations.getAll(currentCompany.id);
          quotations = (res?.success ? res.data : res) || [];
        }
        if (dataFocus === 'all' || dataFocus === 'challans') {
          const res = await db.deliveryChallans.getAll(currentCompany.id);
          challans = (res?.success ? res.data : res) || [];
        }
        
        rows = [
          ...invoices.map((r: any) => ({ ...r, __module: 'sales', __type: 'Invoice', number: r.invoice_number, date: r.invoice_date, customer: r.customer_name, total: r.total_amount })),
          ...quotations.map((r: any) => ({ ...r, __module: 'sales', __type: 'Quotation', number: r.quotation_number, date: r.quotation_date, customer: r.customer_name, total: r.total_amount })),
          ...challans.map((r: any) => ({ ...r, __module: 'sales', __type: 'Challan', number: r.challan_number, date: r.challan_date, customer: r.customer_name, total: 0 })),
        ];
      } else if (moduleKey === 'purchases') {
        const res = await db.purchaseInvoices.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        rows = data.map((r: any) => ({ ...r, __module: 'purchases', __type: 'Purchase', number: r.invoice_number, date: r.invoice_date, vendor: r.vendor_name, total: r.total_amount }));
      } else if (moduleKey === 'inventory') {
        const res = await db.items.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        rows = data.map((r: any) => ({ ...r, __module: 'inventory', __type: 'Item', brand: r.brand_name, category: r.category_name, sell_price: r.selling_price }));
      } else if (moduleKey === 'payments') {
        const res = await db.payments.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        const baseRows = data.map((r: any) => ({ ...r, __module: 'payments', __type: 'Payment', number: r.payment_number, date: r.payment_date, party: r.customer_name || r.vendor_name, type: r.payment_type, method: r.payment_method }));
        
        if (dataFocus !== 'all') {
            rows = baseRows.filter((r: any) => r.type === dataFocus);
        } else {
            rows = baseRows;
        }
      }

      setAllRows(rows);
    } catch (err) {
      console.error('Failed to load data:', err);
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [moduleKey, dataFocus, currentCompany?.id]);

  const applyFilters = (rows: UnifiedRow[]) => {
    return rows.filter(row => {
      for (const f of filters) {
        const val = row[f.fieldKey];
        const fieldDef = fields.find(fd => fd.key === f.fieldKey);
        if (!fieldDef) continue;

        if (fieldDef.type === 'string' || fieldDef.type === 'enum') {
          const sVal = String(val || '').toLowerCase();
          const fVal = String(f.value || '').toLowerCase();
          if (f.operator === 'contains' && !sVal.includes(fVal)) return false;
          if (f.operator === 'equals' && sVal !== fVal) return false;
        } else if (fieldDef.type === 'number') {
          const nVal = Number(val || 0);
          if (f.operator === 'equals' && nVal !== Number(f.value)) return false;
          if (f.operator === 'gt' && nVal <= Number(f.value)) return false;
          if (f.operator === 'lt' && nVal >= Number(f.value)) return false;
          if (f.operator === 'between' && (nVal < Number(f.from) || nVal > Number(f.to))) return false;
        } else if (fieldDef.type === 'date') {
          const dVal = dayjs(val);
          if (!dVal.isValid()) return false;
          if (f.operator === 'before' && !dVal.isBefore(dayjs(f.value), 'day')) return false;
          if (f.operator === 'after' && !dVal.isAfter(dayjs(f.value), 'day')) return false;
          if (f.operator === 'between' && (!dVal.isAfter(dayjs(f.from).subtract(1, 'day')) || !dVal.isBefore(dayjs(f.to).add(1, 'day')))) return false;
        }
      }
      return true;
    });
  };

  const filteredRows = useMemo(() => applyFilters(allRows), [allRows, filters]);

  const columns = useMemo(() => {
    return selectedColumns.map(colKey => {
      const field = fields.find(f => f.key === colKey);
      return {
        title: field?.label || colKey,
        dataIndex: colKey,
        key: colKey,
        render: (val: any) => {
          if (field?.type === 'date') return val ? dayjs(val).format('DD-MM-YYYY') : '-';
          if (field?.type === 'number') return typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : val;
          return val || '-';
        }
      };
    });
  }, [selectedColumns, fields]);

  const handleAddFilter = () => {
    if (!pendingFilterField) return;
    const newFilter: FilterDef = {
      id: Math.random().toString(36).substr(2, 9),
      fieldKey: pendingFilterField,
      operator: pendingOperator,
      value: pendingValue,
      from: pendingFrom,
      to: pendingTo,
    };
    setFilters([...filters, newFilter]);
    // Reset inputs
    setPendingValue(undefined);
    setPendingFrom(undefined);
    setPendingTo(undefined);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return message.warning('Please enter a name');
    if (!currentCompany) return;

    const config: TemplateConfig = {
      module: moduleKey,
      dataFocus: dataFocus,
      columns: selectedColumns,
      filters: filters
    };

    try {
      const res = await (window as any).electronAPI.db.customReports.create({
        company_id: currentCompany.id,
        name: templateName,
        module: moduleKey,
        config: JSON.stringify(config)
      });
      if (res?.success) {
        message.success('Report template saved');
        setSaveModalOpen(false);
        setTemplateName('');
      } else {
        message.error(res?.error || 'Failed to save template');
      }
    } catch (err) {
      message.error('Failed to save template');
    }
  };

  const loadTemplates = async () => {
    if (!currentCompany) return;
    try {
      const res = await (window as any).electronAPI.db.customReports.getAll(currentCompany.id);
      if (res?.success) {
        setSavedTemplates(res.data || []);
        setLoadModalOpen(true);
      } else {
        message.error(res?.error || 'Failed to load templates');
      }
    } catch (err) {
      message.error('Failed to load templates');
    }
  };

  const handleApplyTemplate = (template: any) => {
    try {
      const config = JSON.parse(template.config) as TemplateConfig;
      setModuleKey(config.module);
      setTimeout(() => {
        setSelectedColumns(config.columns);
        setFilters(config.filters);
        if (config.dataFocus) {
            setDataFocus(config.dataFocus);
        }
        setLoadModalOpen(false);
        message.success(`Loaded "${template.name}"`);
      }, 0);
    } catch (err) {
      message.error('Invalid template configuration');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
      try {
          const res = await (window as any).electronAPI.db.customReports.delete(id);
          if (res?.success) {
            setSavedTemplates(savedTemplates.filter(t => t.id !== id));
            message.success('Template deleted');
          } else {
            message.error(res?.error || 'Failed to delete template');
          }
      } catch (err) {
          message.error('Failed to delete template');
      }
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Custom Report Builder</Title>
          <Text type="secondary">Build, preview, and save your custom reports dynamically.</Text>
        </div>
        <Space>
          <Button icon={<FolderOpenOutlined />} onClick={loadTemplates}>Saved Reports</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>Save Template</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Sidebar Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title="1. Select Module" size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {MODULES.map(m => (
                <div key={m.key}>
                  <div 
                    onClick={() => setModuleKey(m.key)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${moduleKey === m.key ? m.color : '#f0f0f0'}`,
                      background: moduleKey === m.key ? `${m.color}10` : '#fff',
                      transition: 'all 0.3s'
                    }}
                  >
                    <Space>
                      <Badge color={m.color} />
                      <Text strong style={{ color: moduleKey === m.key ? m.color : 'inherit' }}>{m.label}</Text>
                      {moduleKey === m.key && <ArrowRightOutlined style={{ color: m.color }} />}
                    </Space>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="2. Select Columns" size="small">
            <Checkbox.Group 
              style={{ width: '100%' }} 
              value={selectedColumns} 
              onChange={(vals) => setSelectedColumns(vals as string[])}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fields.map(f => (
                  <Checkbox key={f.key} value={f.key}>{f.label}</Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Card>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Filters Section */}
          <Card title={<Space><FilterOutlined /> Filters</Space>} size="small">
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>Report Focus / Section</Text>
                <Select 
                  style={{ width: 250 }}
                  value={dataFocus}
                  onChange={setDataFocus}
                  options={FOCAL_OPTIONS[moduleKey]}
                />
              </Space>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Space wrap>
                <Select 
                  style={{ width: 180 }} 
                  placeholder="Select Field" 
                  value={pendingFilterField || undefined}
                  onChange={setPendingFilterField}
                  options={filterableFields.map(f => ({ label: f.label, value: f.key }))}
                />
                
                {selectedFieldDef && (
                  <Select 
                    style={{ width: 140 }} 
                    value={pendingOperator}
                    onChange={setPendingOperator}
                    options={
                      selectedFieldDef.type === 'string' || selectedFieldDef.type === 'enum' 
                        ? [{ label: 'Contains', value: 'contains' }, { label: 'Equals', value: 'equals' }]
                        : selectedFieldDef.type === 'number'
                        ? [{ label: '=', value: 'equals' }, { label: '>', value: 'gt' }, { label: '<', value: 'lt' }, { label: 'Between', value: 'between' }]
                        : [{ label: 'Before', value: 'before' }, { label: 'After', value: 'after' }, { label: 'Between', value: 'between' }]
                    }
                  />
                )}

                {selectedFieldDef && pendingOperator !== 'between' && (
                  selectedFieldDef.type === 'date' ? (
                    <DatePicker value={pendingValue} onChange={setPendingValue} />
                  ) : selectedFieldDef.type === 'number' ? (
                    <InputNumber placeholder="Value" value={pendingValue} onChange={setPendingValue} />
                  ) : (
                    <Input placeholder="Value" value={pendingValue} onChange={e => setPendingValue(e.target.value)} />
                  )
                )}

                {selectedFieldDef && pendingOperator === 'between' && (
                  selectedFieldDef.type === 'date' ? (
                    <RangePicker value={[pendingFrom, pendingTo]} onChange={(dates) => { setPendingFrom(dates?.[0]); setPendingTo(dates?.[1]); }} />
                  ) : (
                    <Space>
                      <InputNumber placeholder="From" value={pendingFrom} onChange={setPendingFrom} />
                      <InputNumber placeholder="To" value={pendingTo} onChange={setPendingTo} />
                    </Space>
                  )
                )}

                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddFilter} disabled={!pendingFilterField}>Add</Button>
              </Space>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filters.map(f => {
                const field = fields.find(fd => fd.key === f.fieldKey);
                return (
                  <Tag 
                    key={f.id} 
                    closable 
                    onClose={() => setFilters(filters.filter(x => x.id !== f.id))}
                    color="blue"
                    style={{ padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <Text strong>{field?.label}</Text> {f.operator} {
                      f.operator === 'between' 
                        ? `${f.from?.format?.('DD-MM-YYYY') || f.from} - ${f.to?.format?.('DD-MM-YYYY') || f.to}`
                        : f.value?.format?.('DD-MM-YYYY') || f.value || ''
                    }
                  </Tag>
                );
              })}
              {filters.length === 0 && <Text type="secondary">No filters applied.</Text>}
            </div>
          </Card>

          {/* Preview Table */}
          <Card 
            title={<Space><ReloadOutlined spin={loading} /> Preview Results</Space>} 
            size="small"
            extra={<Tag color="blue">{filteredRows.length} Items Found</Tag>}
          >
            <Table 
              dataSource={filteredRows} 
              columns={columns} 
              loading={loading}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 15 }}
              scroll={{ x: 'max-content' }}
              bordered
            />
          </Card>
        </div>
      </div>

      {/* Save Template Modal */}
      <Modal
        title="Save Report Template"
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={handleSaveTemplate}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>Template Name</Text>
          <Input 
            autoFocus
            placeholder="e.g. Sales Pending Over 5000" 
            value={templateName} 
            onChange={e => setTemplateName(e.target.value)} 
            style={{ marginTop: '8px' }}
          />
        </div>
        <Alert message="This will save your current module, selected columns, and filters." type="info" showIcon />
      </Modal>

      {/* Load Template Modal */}
      <Modal
        title="Saved Report Templates"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={600}
      >
        <Table 
          dataSource={savedTemplates}
          rowKey="id"
          pagination={false}
          columns={[
            { 
                title: 'Name', 
                dataIndex: 'name', 
                key: 'name',
                render: (text, record) => <Text strong>{text} <Tag color="blue" style={{ marginLeft: 8 }}>{record.module}</Tag></Text>
            },
            { 
                title: 'Created', 
                dataIndex: 'created_at', 
                key: 'created_at',
                render: (val) => dayjs(val).format('DD-MM-YYYY')
            },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Space>
                  <Button type="primary" size="small" onClick={() => handleApplyTemplate(record)}>Load</Button>
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteTemplate(record.id)} />
                </Space>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
};

// Helper components for Modal
const Alert: React.FC<{ message: string; type: string; showIcon: boolean }> = ({ message, type }) => (
    <div style={{ 
        padding: '12px', 
        background: type === 'info' ? '#e6f7ff' : '#fffbe6', 
        border: `1px solid ${type === 'info' ? '#91d5ff' : '#ffe58f'}`,
        borderRadius: '4px',
        color: 'rgba(0,0,0,0.85)'
    }}>
        {message}
    </div>
);

export default CustomReportBuilder;


