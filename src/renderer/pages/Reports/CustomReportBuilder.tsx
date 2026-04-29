import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message, Badge } from 'antd';
import { PlusOutlined, SaveOutlined, FilterOutlined, ReloadOutlined, DeleteOutlined, FolderOpenOutlined, ArrowRightOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
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
    { key: 'number', label: 'Invoice No', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'date', label: 'Date', type: 'date', filterable: true, columnVisibleByDefault: true },
    { key: 'customer', label: 'Customer', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'customer_ntn', label: 'NTN', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'customer_gst', label: 'GST #', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'salesperson_name', label: 'Sales Person', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'po_number', label: 'PO #', type: 'string', filterable: true, columnVisibleByDefault: true },
    { key: 'item_name', label: 'Item Name', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'hs_code', label: 'HS Code', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'brand', label: 'Brand', type: 'string', filterable: true, columnVisibleByDefault: false },
    { key: 'quantity', label: 'Qty', type: 'number', filterable: true, columnVisibleByDefault: false },
    { key: 'unit_price', label: 'Unit Price', type: 'number', filterable: true, columnVisibleByDefault: false },
    { key: 'gross_amount', label: 'Gross Amount', type: 'number', filterable: true, columnVisibleByDefault: false },
    { key: 'gst_rate', label: 'GST %', type: 'number', filterable: true, columnVisibleByDefault: false },
    { key: 'gst_amount', label: 'GST (18%)', type: 'number', filterable: true, columnVisibleByDefault: false },
    { key: 'total', label: 'Total Amount', type: 'number', filterable: true, columnVisibleByDefault: true },
    { key: 'balance', label: 'Balance', type: 'number', filterable: true, columnVisibleByDefault: false },
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
  const [isGrouped, setIsGrouped] = useState(false);

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
    purchases: [
      { label: 'All Purchases', value: 'all' },
      { label: 'Purchase Invoices', value: 'invoices' },
    ],
    inventory: [
      { label: 'All Inventory', value: 'all' },
      { label: 'Standard Items', value: 'product' },
      { label: 'Services', value: 'service' },
    ],
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

  // Reset values when field changes to prevent type-mismatch crashes
  useEffect(() => {
    setPendingValue(undefined);
    setPendingFrom(undefined);
    setPendingTo(undefined);
    setPendingOperator('contains');
  }, [pendingFilterField]);

  // Default columns and filter reset when module changes
  useEffect(() => {
    const defaultKeys = fields
      .filter(f => f.columnVisibleByDefault !== false)
      .map(f => f.key);
    
    setSelectedColumns(defaultKeys);
    setFilters([]);
    setPendingFilterField('');
    setPendingValue(undefined);
    setPendingFrom(undefined);
    setPendingFrom(undefined);
    setPendingTo(undefined);
    setDataFocus('all'); 
    setIsGrouped(false); // Reset grouping on module change
  }, [moduleKey]);

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

        if (dataFocus === 'challans') {
          const res = await db.deliveryChallans.getChallansByItem(currentCompany.id);
          const challanItems = (res?.success ? res.data : (Array.isArray(res) ? res : [])) || [];
          rows = challanItems.map((r: any) => ({ 
            ...r, 
            __module: 'sales', 
            __type: 'Challan', 
            number: r.challan_number, 
            date: r.challan_date, 
            customer: r.customer_name, 
            customer_ntn: r.customer_ntn,
            customer_gst: r.customer_gst,
            salesperson_name: r.salesperson_name,
            po_number: r.po_number,
            item_name: r.item_name,
            hs_code: r.hs_code,
            description: r.description,
            brand: r.brand,
            quantity: r.quantity,
            unit_price: r.unit_price,
            gross_amount: r.gross_amount,
            total: Number(r.quantity || 0) * Number(r.unit_price || 0),
            status: r.status,
            raw: r,
          }));
        } else if (dataFocus === 'invoices') {
          const res = await db.salesInvoices.getSalesByItem(currentCompany.id);
          const invoiceItems = (res?.success ? res.data : (Array.isArray(res) ? res : [])) || [];
          rows = invoiceItems.map((r: any) => ({ 
            ...r, 
            __module: 'sales', 
            __type: 'Invoice', 
            number: r.invoice_number,
            date: r.invoice_date,
            customer: r.customer_name,
            customer_ntn: r.customer_ntn,
            customer_gst: r.customer_gst,
            salesperson_name: r.salesperson_name,
            po_number: r.po_number,
            item_name: r.item_name,
            hs_code: r.hs_code,
            description: r.description,
            brand: r.brand,
            quantity: r.quantity,
            unit_price: r.unit_price,
            gross_amount: r.gross_amount,
            gst_rate: r.gst_rate,
            gst_amount: r.gst_amount,
            total: r.line_total,
            balance: r.balance,
            status: r.status,
            raw: r,
          }));
        } else {
          if (dataFocus === 'all' || dataFocus === 'invoices') {
            const res = await db.salesInvoices.getAll(currentCompany.id);
            invoices = (res?.success ? res.data : (Array.isArray(res) ? res : [])) || [];
          }
          if (dataFocus === 'all' || dataFocus === 'quotations') {
            const res = await db.salesQuotations.getAll(currentCompany.id);
            quotations = (res?.success ? res.data : (Array.isArray(res) ? res : [])) || [];
          }
          if (dataFocus === 'all' || dataFocus === 'challans') {
            const res = await db.deliveryChallans.getAll(currentCompany.id);
            challans = (res?.success ? res.data : (Array.isArray(res) ? res : [])) || [];
          }
          
          rows = [
            ...invoices.map((r: any) => ({ 
              id: r.id,
              __module: 'sales', 
              __type: 'Invoice', 
              number: r.invoice_number, 
              date: r.invoice_date, 
              customer: r.customer_name, 
              total: r.total_amount,
              status: r.status,
              balance: r.balance
            })),
            ...quotations.map((r: any) => ({ 
              id: r.id,
              __module: 'sales', 
              __type: 'Quotation', 
              number: r.quotation_number, 
              date: r.quotation_date, 
              customer: r.customer_name, 
              total: r.total_amount,
              status: r.status
            })),
            ...challans.map((r: any) => ({ 
              id: r.id,
              __module: 'sales', 
              __type: 'Challan', 
              number: r.challan_number, 
              date: r.challan_date, 
              customer: r.customer_name, 
              total: 0,
              status: r.status
            })),
          ];
        }
      } else if (moduleKey === 'purchases') {
        const res = await db.purchaseInvoices.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        rows = data.map((r: any) => ({ 
          id: r.id,
          __module: 'purchases', 
          __type: 'Purchase', 
          number: r.invoice_number, 
          date: r.invoice_date, 
          vendor: r.vendor_name, 
          total: r.total_amount,
          balance: r.balance,
          status: r.status
        }));
      } else if (moduleKey === 'inventory') {
        const res = await db.items.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        rows = data.map((r: any) => ({ 
          id: r.id,
          __module: 'inventory', 
          __type: 'Item', 
          code: r.item_code,
          name: r.name,
          brand: r.brand_name, 
          category: r.category_name, 
          quantity: r.quantity,
          sell_price: r.selling_price,
          purchase_price: r.purchase_price
        }));
      } else if (moduleKey === 'payments') {
        const res = await db.payments.getAll(currentCompany.id);
        const data = (res?.success ? res.data : res) || [];
        rows = data.map((r: any) => ({ 
          id: r.id,
          __module: 'payments', 
          __type: 'Payment', 
          number: r.payment_number, 
          date: r.payment_date, 
          party: r.customer_name || r.vendor_name, 
          type: r.payment_type, 
          method: r.payment_method,
          amount: r.amount
        }));
        
        if (dataFocus !== 'all') {
            rows = rows.filter((r: any) => r.type === dataFocus);
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
    try {
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
    } catch (err) {
      console.error('Filter crash:', err);
      return rows;
    }
  };

  const filteredRows = useMemo(() => applyFilters(allRows), [allRows, filters]);

  const finalDisplayRows = useMemo(() => {
    if (!isGrouped) return filteredRows;

    // Group by 'number' (Invoice No / Voucher # / etc)
    const groups: Record<string, any> = {};
    filteredRows.forEach(row => {
      const key = String(row.number || row.id || 'unassigned');
      if (!groups[key]) {
        groups[key] = { ...row };
      } else {
        // Accumulate numeric fields
        fields.forEach(f => {
          if (f.type === 'number') {
            groups[key][f.key] = (Number(groups[key][f.key]) || 0) + (Number(row[f.key]) || 0);
          }
        });
        // Combine HS Code uniquely
        if (row.hs_code) {
          const existingCodes = String(groups[key].hs_code || '').split(',').map(s => s.trim());
          if (!existingCodes.includes(row.hs_code)) {
             groups[key].hs_code = groups[key].hs_code ? `${groups[key].hs_code}, ${row.hs_code}` : row.hs_code;
          }
        }
      }
    });
    return Object.values(groups);
  }, [filteredRows, isGrouped, fields]);

  const columns = useMemo(() => {
    // Strictly follow the order defined in FIELDS_BY_MODULE
    return fields
      .filter(f => selectedColumns.includes(f.key))
      .map(field => {
        return {
          title: field.label,
          dataIndex: field.key,
          key: `${moduleKey}-${field.key}`,
          width: 120,
          render: (val: any) => {
            if (field.type === 'date') return val ? dayjs(val).format('DD-MM-YYYY') : '-';
            if (field.type === 'number') {
              const num = Number(val);
              return isNaN(num) ? val || '-' : num.toLocaleString(undefined, { minimumFractionDigits: 2 });
            }
            return val !== null && val !== undefined && val !== '' ? val : '-';
          }
        };
      });
  }, [selectedColumns, fields, moduleKey]);

  const handleAddFilter = () => {
    if (!pendingFilterField) return;
    
    // Validation: ensure value(s) are provided
    if (pendingOperator === 'between') {
      if (pendingFrom === undefined || pendingFrom === null || pendingTo === undefined || pendingTo === null) {
        return message.error('Please provide both range values');
      }
    } else {
      if (pendingValue === undefined || pendingValue === null || pendingValue === '') {
        return message.error('Please provide a filter value');
      }
    }

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
      } else if (res?.code === 'CONFLICT') {
        message.error('A report template with this name already exists');
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

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      return message.warning('No data to export');
    }

    try {
      // Prepare data for Excel based on selected columns
      const exportData = filteredRows.map(row => {
        const rowData: any = {};
        selectedColumns.forEach(colKey => {
          const field = fields.find(f => f.key === colKey);
          let val = row[colKey];
          
          if (field?.type === 'date' && val) {
            val = dayjs(val).format('DD-MM-YYYY');
          } else if (field?.type === 'number' && typeof val === 'number') {
            // Keep as number for Excel formatting
          } else {
            val = val || '-';
          }
          
          const label = field?.label || colKey;
          rowData[label] = val;
        });
        return rowData;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom Report');
      
      // Auto-size columns (basic implementation)
      const max_width = exportData.reduce((w, r) => Math.max(w, Object.values(r).join('').length), 10);
      worksheet['!cols'] = selectedColumns.map(() => ({ wch: 15 }));

      const fileName = `Custom_Report_${moduleKey}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      message.success('Report exported successfully');
    } catch (error) {
      console.error('Excel Export Error:', error);
      message.error('Failed to export to Excel');
    }
  };

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingId || !adminPassword) {
      message.error('Admin password is required');
      return;
    }

    setDeleteLoading(true);
    try {
      const verifyRes = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
      const isVerified = verifyRes?.success ? verifyRes.data : verifyRes;

      if (!isVerified) {
        message.error('Incorrect admin password');
        setDeleteLoading(false);
        return;
      }

      const res = await (window as any).electronAPI.db.customReports.delete(deletingId);
      if (res?.success) {
        setSavedTemplates(savedTemplates.filter(t => t.id !== deletingId));
        message.success('Template deleted successfully');
        setDeleteModalVisible(false);
        setDeletingId(null);
        setAdminPassword('');
      } else {
        message.error(res?.error || 'Failed to delete template');
      }
    } catch (err) {
      console.error('Delete template error:', err);
      message.error('An error occurred during deletion');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    setDeletingId(id);
    setAdminPassword('');
    setDeleteModalVisible(true);
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
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} disabled={filteredRows.length === 0}>Export Excel</Button>
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

          <Card 
            title="2. Select Columns" 
            size="small"
            extra={
              <Checkbox 
                indeterminate={selectedColumns.length > 0 && selectedColumns.length < fields.length}
                checked={selectedColumns.length === fields.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedColumns(fields.map(f => f.key));
                  } else {
                    setSelectedColumns([]);
                  }
                }}
              >
                All
              </Checkbox>
            }
          >
            <Checkbox.Group 
              style={{ width: '100%' }} 
              value={selectedColumns} 
              onChange={(vals) => {
                // Ensure columns maintain their defined order in FIELDS_BY_MODULE
                const ordered = fields
                  .filter(f => (vals as string[]).includes(f.key))
                  .map(f => f.key);
                setSelectedColumns(ordered);
              }}
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
                  style={{ width: 160 }}
                  value={dataFocus}
                  onChange={setDataFocus}
                  options={FOCAL_OPTIONS[moduleKey] || []}
                />
                {moduleKey === 'sales' && dataFocus === 'invoices' && (
                  <Button 
                    type="primary" 
                    ghost
                    icon={<FileExcelOutlined />}
                    onClick={() => {
                      const fbrCols = ['date', 'number', 'customer', 'hs_code', 'customer_ntn', 'quantity', 'gross_amount', 'gst_amount', 'total'];
                      setSelectedColumns(fbrCols);
                      setIsGrouped(true); // FBR Report is usually per invoice
                      message.success('FBR Report layout & summary applied');
                    }}
                  >
                    Generate FBR Report
                  </Button>
                )}
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

                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFilter}>Add</Button>
                <Checkbox 
                  checked={isGrouped} 
                  onChange={e => setIsGrouped(e.target.checked)}
                  style={{ marginLeft: 16 }}
                >
                  <Text strong>Summary View (Group by No)</Text>
                </Checkbox>
              </Space>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filters.map(f => {
                const field = fields.find(fd => fd.key === f.fieldKey);
                if (!field) return null;
                
                const formatVal = (v: any) => {
                  if (dayjs.isDayjs(v)) return v.format('DD-MM-YYYY');
                  return String(v || '');
                };

                return (
                  <Tag 
                    key={f.id} 
                    closable 
                    onClose={() => setFilters(filters.filter(x => x.id !== f.id))}
                    color="blue"
                    style={{ padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <Text strong>{field.label}</Text> {f.operator} {
                      f.operator === 'between' 
                        ? `${formatVal(f.from)} - ${formatVal(f.to)}`
                        : formatVal(f.value)
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
            extra={<Tag color="blue">{finalDisplayRows.length} Items Found</Tag>}
          >
            <Table 
              key={`${moduleKey}-${dataFocus}-${selectedColumns.length}-${selectedColumns[0] || 'none'}-${isGrouped}`}
              dataSource={finalDisplayRows} 
              columns={columns} 
              loading={loading}
              rowKey={(record) => record.id || record.number || `row-${Math.random()}`}
              size="middle"
              pagination={{ pageSize: 15 }}
              scroll={{ x: 'max-content' }}
              bordered
            />
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal with Premium Design */}
      <Modal
        title={null}
        open={deleteModalVisible}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteModalVisible(false);
            setAdminPassword('');
          }
        }}
        footer={null}
        width={400}
        centered
        bodyStyle={{ padding: 0 }}
      >
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #ffffff 0%, #f9f9f9 100%)',
          borderRadius: '12px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#fff2f0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)'
          }}>
            <DeleteOutlined style={{ fontSize: '28px', color: '#ff4d4f' }} />
          </div>
          
          <Title level={4} style={{ marginBottom: '8px' }}>Security Verification</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
            This action requires administrator approval. Please enter your password to proceed.
          </Text>

          <Input.Password
            placeholder="Admin password"
            size="large"
            value={adminPassword}
            autoFocus
            onChange={(e) => setAdminPassword(e.target.value)}
            onPressEnter={handleDeleteConfirm}
            style={{ marginBottom: '24px', borderRadius: '8px' }}
            disabled={deleteLoading}
          />

          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              size="large" 
              style={{ width: '120px', borderRadius: '8px' }}
              onClick={() => {
                setDeleteModalVisible(false);
                setAdminPassword('');
              }}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              danger 
              size="large" 
              style={{ width: '120px', borderRadius: '8px' }}
              loading={deleteLoading}
              onClick={handleDeleteConfirm}
            >
              Verify & Delete
            </Button>
          </Space>
        </div>
      </Modal>

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


