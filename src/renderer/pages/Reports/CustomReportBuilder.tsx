import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, SaveOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const { RangePicker } = DatePicker;
const { Text } = Typography;

type ModuleKey = 'sales' | 'inventory';

type FieldType = 'string' | 'number' | 'date' | 'enum';

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  filterable?: boolean;
  columnVisibleByDefault?: boolean;
};

type UnifiedRow = Record<string, any> & { __rowType: ModuleKey; __docType: string };

type FilterDef = {
  id: string;
  fieldKey: string;
  operator: string;
  // For date/number "between" we store { from, to }, else { single }.
  value?: any;
  from?: any;
  to?: any;
};

type TemplateConfig = {
  moduleKey: ModuleKey;
  columns: string[];
  filters: FilterDef[];
};

const MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
];

// MVP field sets (can be expanded later).
const FIELDS_BY_MODULE: Record<ModuleKey, FieldDef[]> = {
  sales: [
    { key: '__docType', label: 'Document Type', type: 'enum', filterable: true, columnVisibleByDefault: true },
    { key: 'doc_number', label: 'Document #', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'doc_date', label: 'Date', type: 'date', filterable: true, columnVisibleByDefault: true },
    { key: 'customer_name', label: 'Customer', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'po_number', label: 'PO / PR #', type: 'string', filterable: true },
    { key: 'status', label: 'Status', type: 'enum', filterable: true },
    { key: 'total_amount', label: 'Amount', type: 'number', filterable: true },
    { key: 'balance', label: 'Balance', type: 'number', filterable: true },
    { key: 'gst_total', label: 'GST Total', type: 'number', filterable: true },
    { key: 'subtotal', label: 'Subtotal', type: 'number', filterable: true },
    { key: 'total_quantity', label: 'Quantity (DC)', type: 'number', filterable: true },
    { key: 'notes', label: 'Notes', type: 'string', filterable: true },
  ],
  inventory: [
    { key: '__docType', label: 'Entity Type', type: 'enum', filterable: true, columnVisibleByDefault: true },
    { key: 'code', label: 'Code', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'name', label: 'Name', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'brand_name', label: 'Brand', type: 'string', filterable: true },
    { key: 'sku', label: 'SKU', type: 'string', filterable: true },
    { key: 'description', label: 'Description', type: 'string', filterable: true },
    { key: 'location', label: 'Location', type: 'string', filterable: true },
    { key: 'quantity', label: 'Quantity', type: 'number', filterable: true },
    { key: 'reorder_level', label: 'Reorder Level', type: 'number', filterable: true },
    { key: 'hs_code', label: 'HS Code', type: 'string', filterable: true },
    { key: 'address', label: 'Address (Warehouse)', type: 'string', filterable: false },
    { key: 'is_default', label: 'Default (Warehouse)', type: 'enum', filterable: false },
  ],
};

function toISODateOrNull(d: any): string | null {
  if (!d) return null;
  const v = typeof d === 'string' ? d : d?.toString?.() ?? '';
  if (v && v.length >= 10) return String(v).slice(0, 10);
  // dayjs
  try {
    return dayjs(d).format('YYYY-MM-DD');
  } catch {
    return null;
  }
}

function safeNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function applyFilters(rows: UnifiedRow[], moduleKey: ModuleKey, fields: FieldDef[], filters: FilterDef[]): UnifiedRow[] {
  if (!filters.length) return rows;
  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  return rows.filter((r) => {
    for (const f of filters) {
      const def = fieldMap.get(f.fieldKey);
      if (!def) continue;
      const raw = r[f.fieldKey];
      if (def.type === 'string' || def.type === 'enum') {
        const s = raw == null ? '' : String(raw);
        const val = f.value == null ? '' : String(f.value);
        if (f.operator === 'contains') {
          if (!s.toLowerCase().includes(val.toLowerCase())) return false;
        } else if (f.operator === 'equals') {
          if (s !== val) return false;
        }
      } else if (def.type === 'number') {
        const n = safeNumber(raw);
        if (n == null) return false;
        if (f.operator === 'gt') {
          const v = safeNumber(f.value);
          if (v == null || !(n > v)) return false;
        } else if (f.operator === 'lt') {
          const v = safeNumber(f.value);
          if (v == null || !(n < v)) return false;
        } else if (f.operator === 'equals') {
          const v = safeNumber(f.value);
          if (v == null || !(n === v)) return false;
        } else if (f.operator === 'between') {
          const from = safeNumber(f.from);
          const to = safeNumber(f.to);
          if (from == null || to == null) return false;
          const min = Math.min(from, to);
          const max = Math.max(from, to);
          if (!(n >= min && n <= max)) return false;
        }
      } else if (def.type === 'date') {
        const iso = toISODateOrNull(raw);
        if (!iso) return false;
        if (f.operator === 'before') {
          const to = toISODateOrNull(f.value);
          if (!to) return false;
          if (iso >= to) return false;
        } else if (f.operator === 'after') {
          const from = toISODateOrNull(f.value);
          if (!from) return false;
          if (iso <= from) return false;
        } else if (f.operator === 'between') {
          const from = toISODateOrNull(f.from);
          const to = toISODateOrNull(f.to);
          if (!from || !to) return false;
          const min = from <= to ? from : to;
          const max = from <= to ? to : from;
          if (!(iso >= min && iso <= max)) return false;
        }
      }
    }
    return true;
  });
}

function buildColumns(fields: FieldDef[], selectedColumns: string[]): any[] {
  const selectedFieldDefs = selectedColumns
    .map((k) => fields.find((f) => f.key === k))
    .filter(Boolean) as FieldDef[];

  return selectedFieldDefs.map((f) => {
    return {
      title: f.label,
      dataIndex: f.key,
      key: f.key,
      render: (val: any) => {
        if (val == null || val === '') return '—';
        if (f.type === 'date') {
          return dayjs(val).isValid() ? dayjs(val).format('DD-MMM-YYYY') : String(val);
        }
        if (f.type === 'number') {
          const n = safeNumber(val);
          return n == null ? '—' : n.toLocaleString();
        }
        return String(val);
      },
    };
  });
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

const CustomReportBuilder: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [moduleKey, setModuleKey] = useState<ModuleKey>('sales');
  const fields = useMemo(() => FIELDS_BY_MODULE[moduleKey], [moduleKey]);

  const [allRows, setAllRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() =>
    FIELDS_BY_MODULE.sales.filter((f) => f.columnVisibleByDefault).map((f) => f.key)
  );

  const [filters, setFilters] = useState<FilterDef[]>([]);

  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState('');

  // Add filter UI state
  const [pendingFilterField, setPendingFilterField] = useState<string>('');
  const [pendingOperator, setPendingOperator] = useState<string>('contains');
  const [pendingValue, setPendingValue] = useState<any>(undefined);
  const [pendingFrom, setPendingFrom] = useState<any>(undefined);
  const [pendingTo, setPendingTo] = useState<any>(undefined);

  const filterableFields = useMemo(() => fields.filter((f) => f.filterable), [fields]);
  const selectedFieldDef = useMemo(() => fields.find((f) => f.key === pendingFilterField), [fields, pendingFilterField]);

  const operatorOptions = useMemo(() => {
    if (!selectedFieldDef) return [];
    if (selectedFieldDef.type === 'string' || selectedFieldDef.type === 'enum') {
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'equals', label: 'Equals' },
      ];
    }
    if (selectedFieldDef.type === 'number') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'gt', label: 'Greater than' },
        { value: 'lt', label: 'Less than' },
        { value: 'between', label: 'Between' },
      ];
    }
    if (selectedFieldDef.type === 'date') {
      return [
        { value: 'between', label: 'Between' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
      ];
    }
    return [];
  }, [selectedFieldDef]);

  useEffect(() => {
    // Reset defaults when module changes unless the user already selected something.
    const defaultCols = FIELDS_BY_MODULE[moduleKey].filter((f) => f.columnVisibleByDefault).map((f) => f.key);
    setSelectedColumns((prev) => (prev.length ? prev : defaultCols));
    setFilters([]);
  }, [moduleKey]);

  const loadAllRows = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      if (moduleKey === 'sales') {
        const [invRes, quoRes, dcRes] = await Promise.all([
          (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id, {}),
          (window as any).electronAPI.db.salesQuotations.getAll(currentCompany.id, {}),
          (window as any).electronAPI.db.deliveryChallans.getAll(currentCompany.id),
        ]);

        const invoices = (invRes?.success ? invRes.data : []) || [];
        const quotations = (quoRes?.success ? quoRes.data : []) || [];
        const challans = (dcRes?.success ? dcRes.data : []) || [];

        const mapped: UnifiedRow[] = [
          ...invoices.map((r: any) => ({
            __docType: 'Invoice',
            __rowType: 'sales',
            id: r.id,
            doc_number: r.invoice_number,
            doc_date: r.invoice_date,
            customer_name: r.customer_name,
            po_number: r.po_number,
            status: r.status,
            total_amount: r.total_amount,
            balance: r.balance,
            gst_total: r.gst_total,
            subtotal: r.subtotal,
            total_quantity: null,
            notes: r.notes,
          })),
          ...quotations.map((r: any) => ({
            __docType: 'Quotation',
            __rowType: 'sales',
            id: r.id,
            doc_number: r.quotation_number,
            doc_date: r.quotation_date,
            customer_name: r.customer_name,
            po_number: r.pr_number,
            status: r.status,
            total_amount: r.total_amount,
            balance: 0,
            gst_total: r.tax_amount,
            subtotal: r.subtotal,
            total_quantity: null,
            notes: r.terms_and_conditions || r.notes,
          })),
          ...challans.map((r: any) => ({
            __docType: 'Delivery Challan',
            __rowType: 'sales',
            id: r.id,
            doc_number: r.challan_number,
            doc_date: r.challan_date,
            customer_name: r.customer_name,
            po_number: r.po_number,
            status: r.status,
            total_amount: null,
            balance: 0,
            gst_total: null,
            subtotal: null,
            total_quantity: r.total_quantity,
            notes: r.notes,
          })),
        ];

        setAllRows(mapped);
      } else {
        const [itemsRes, warehousesRes] = await Promise.all([
          (window as any).electronAPI.db.items.getAll(currentCompany.id),
          (window as any).electronAPI.db.warehouses.getAll(currentCompany.id),
        ]);

        const items = (itemsRes?.success ? itemsRes.data : []) || [];
        const warehouses = (warehousesRes?.success ? warehousesRes.data : []) || [];

        const mapped: UnifiedRow[] = [
          ...items.map((r: any) => ({
            __docType: 'Item',
            __rowType: 'inventory',
            id: r.id,
            code: r.code,
            name: r.name,
            brand_name: r.brand_name,
            sku: r.sku,
            description: r.description,
            location: r.location,
            quantity: r.quantity,
            reorder_level: r.reorder_level,
            hs_code: r.hs_code,
            address: null,
            is_default: null,
          })),
          ...warehouses.map((r: any) => ({
            __docType: 'Warehouse',
            __rowType: 'inventory',
            id: r.id,
            code: r.code,
            name: r.name,
            brand_name: null,
            sku: null,
            description: null,
            location: null,
            quantity: null,
            reorder_level: null,
            hs_code: null,
            address: r.address,
            is_default: r.is_default,
          })),
        ];
        setAllRows(mapped);
      }
    } catch (e) {
      // keep UI responsive
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentCompany) return;
    void loadAllRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id, moduleKey]);

  const previewRows = useMemo(() => applyFilters(allRows, moduleKey, fields, filters), [allRows, moduleKey, fields, filters]);

  const columns = useMemo(() => buildColumns(fields, selectedColumns), [fields, selectedColumns]);

  const loadSavedTemplates = async () => {
    if (!currentCompany || !user) return;
    try {
      const res = await (window as any).electronAPI.db.reportTemplates.getAllByUser(currentCompany.id, user.id, moduleKey);
      setSavedTemplates((res?.data || res || []) as any[]);
    } catch {
      setSavedTemplates([]);
    }
  };

  useEffect(() => {
    if (!currentCompany || !user) return;
    void loadSavedTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id, user?.id, moduleKey]);

  const handleSelectTemplate = (id: number) => {
    const tpl = savedTemplates.find((t) => t.id === id);
    if (!tpl) return;
    try {
      const parsed: TemplateConfig = JSON.parse(tpl.config_json || '{}');
      if (!parsed.moduleKey) return;
      setModuleKey(parsed.moduleKey);
      setSelectedColumns(parsed.columns || []);
      setFilters(parsed.filters || []);
      setSelectedTemplateId(id);
    } catch {
      // ignore
    }
  };

  const openSaveModal = () => {
    setSaveNameDraft('');
    setSaveModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentCompany || !user) return;
    const name = saveNameDraft.trim();
    if (!name) return;
    const config: TemplateConfig = { moduleKey, columns: selectedColumns, filters };
    try {
      await (window as any).electronAPI.db.reportTemplates.create({
        user_id: user.id,
        company_id: currentCompany.id,
        module_key: moduleKey,
        report_name: name,
        config_json: JSON.stringify(config),
      });
      setSaveModalOpen(false);
      setSelectedTemplateId(undefined);
      await loadSavedTemplates();
    } catch {
      // ignore for MVP
    }
  };

  const getFieldDef = (key: string) => fields.find((f) => f.key === key);

  const operatorsForField = (fieldKey: string) => {
    const def = getFieldDef(fieldKey);
    if (!def) return [];
    if (def.type === 'string' || def.type === 'enum') return ['contains', 'equals'];
    if (def.type === 'number') return ['equals', 'gt', 'lt', 'between'];
    if (def.type === 'date') return ['between', 'before', 'after'];
    return ['equals'];
  };

  const handleAddFilter = () => {
    if (!pendingFilterField) return;
    const def = getFieldDef(pendingFilterField);
    if (!def) return;

    if (def.type === 'string' || def.type === 'enum') {
      if (pendingValue == null || String(pendingValue).trim() === '') return;
    }
    if (def.type === 'number') {
      if (pendingOperator === 'between') {
        if (pendingFrom == null || pendingTo == null) return;
      } else {
        if (pendingValue == null || String(pendingValue).trim() === '') return;
      }
    }
    if (def.type === 'date') {
      if (pendingOperator === 'between') {
        if (!pendingFrom || !pendingTo) return;
      } else {
        if (!pendingValue) return;
      }
    }

    const next: FilterDef = {
      id: generateId('flt'),
      fieldKey: pendingFilterField,
      operator: pendingOperator,
      value: pendingValue,
      from: pendingFrom,
      to: pendingTo,
    };
    setFilters((prev) => [...prev, next]);
    // reset input fields
    setPendingValue(undefined);
    setPendingFrom(undefined);
    setPendingTo(undefined);
  };

  const moduleLabel = MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Custom Report Builder</h1>
          <Text type="secondary">Build a template with selected columns and filters. Preview updates instantly.</Text>
        </div>
        <Space>
          <Select<ModuleKey>
            value={moduleKey}
            onChange={(v) => setModuleKey(v)}
            style={{ width: 200 }}
            options={MODULES.map((m) => ({ value: m.key, label: m.label }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadAllRows()} disabled={loading}>
            Refresh Data
          </Button>
          <Button icon={<SaveOutlined />} type="primary" onClick={openSaveModal}>
            Save
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text strong>Select Columns</Text>
            <div style={{ marginTop: 8 }}>
              <Checkbox.Group
                value={selectedColumns}
                onChange={(vals) => setSelectedColumns(vals as string[])}
              >
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {fields.map((f) => (
                    <Checkbox key={f.key} value={f.key}>
                      {f.label}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </div>
          </div>

          <div>
            <Space align="baseline">
              <FilterOutlined />
              <Text strong>Filters</Text>
            </Space>
            <div style={{ marginTop: 12 }}>
              <Space wrap align="baseline">
                <Select
                  value={pendingFilterField || undefined}
                  onChange={(v) => {
                    setPendingFilterField(v);
                    const ops = operatorsForField(v);
                    setPendingOperator(ops[0] || 'contains');
                  }}
                  style={{ width: 220 }}
                  placeholder="Field"
                  options={filterableFields.map((f) => ({ value: f.key, label: f.label }))}
                />

                <Select
                  value={pendingOperator}
                  onChange={setPendingOperator}
                  style={{ width: 180 }}
                  options={operatorOptions}
                />

                {selectedFieldDef?.type === 'string' || selectedFieldDef?.type === 'enum' ? (
                  <Input
                    style={{ width: 220 }}
                    placeholder="Value"
                    value={pendingValue}
                    onChange={(e) => setPendingValue(e.target.value)}
                  />
                ) : null}

                {selectedFieldDef?.type === 'number' ? (
                  pendingOperator === 'between' ? (
                    <Space>
                      <InputNumber value={pendingFrom} onChange={setPendingFrom} placeholder="From" />
                      <InputNumber value={pendingTo} onChange={setPendingTo} placeholder="To" />
                    </Space>
                  ) : (
                    <InputNumber value={pendingValue} onChange={setPendingValue} placeholder="Value" />
                  )
                ) : null}

                {selectedFieldDef?.type === 'date' ? (
                  pendingOperator === 'between' ? (
                    <RangePicker
                      value={[pendingFrom, pendingTo] as any}
                      onChange={(vals) => {
                        setPendingFrom(vals?.[0]);
                        setPendingTo(vals?.[1]);
                      }}
                    />
                  ) : (
                    <DatePicker value={pendingValue} onChange={(v) => setPendingValue(v)} />
                  )
                ) : null}

                <Button icon={<PlusOutlined />} onClick={handleAddFilter} disabled={!pendingFilterField}>
                  Add Filter
                </Button>
              </Space>
            </div>

            {filters.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {filters.map((f) => {
                  const fd = fields.find((x) => x.key === f.fieldKey);
                  const label = fd?.label || f.fieldKey;
                  const text =
                    f.operator === 'between'
                      ? `${label}: ${String(f.from ? dayjs(f.from).format('YYYY-MM-DD') : f.from)}..${String(
                          f.to ? dayjs(f.to).format('YYYY-MM-DD') : f.to
                        )}`
                      : `${label}: ${f.value ?? ''}`;
                  return (
                    <Tag
                      key={f.id}
                      closable
                      onClose={() => setFilters((prev) => prev.filter((x) => x.id !== f.id))}
                    >
                      {text}
                    </Tag>
                  );
                })}
              </div>
            )}
          </div>
        </Space>
      </Card>

      <Card>
        <Space style={{ marginBottom: 12 }}>
          <Text strong>Preview: </Text>
          <Text type="secondary">{moduleLabel}</Text>
          <Tag color="blue">{previewRows.length} rows</Tag>
        </Space>
        <Table
          rowKey={(r: any) => `${r.__docType}-${r.id}`}
          columns={columns}
          dataSource={previewRows}
          pagination={{ pageSize: 20 }}
          loading={loading}
          size="small"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="Save Report Template"
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={handleSaveTemplate}
        okText="Save"
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Enter a name for your saved template. It will be stored per user in the database.</Text>
        </div>
        <Input value={saveNameDraft} onChange={(e) => setSaveNameDraft(e.target.value)} placeholder="e.g. Sales Custom - Pending Invoices" />
        {savedTemplates.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Saved Reports (this module)</Text>
            <div style={{ marginTop: 8 }}>
              <Select
                style={{ width: '100%' }}
                value={selectedTemplateId}
                placeholder="Select a saved template to load"
                onChange={(v) => v != null && handleSelectTemplate(Number(v))}
                options={savedTemplates.map((t) => ({ value: t.id, label: t.report_name }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomReportBuilder;

