import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, notification, Alert, Progress, Tag, Switch, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PrinterOutlined, LockOutlined, StopOutlined, EyeOutlined, SearchOutlined, MinusSquareOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { filterRowsByOperationalFiscalYear } from '../../utils/fiscalYearFilter';
import PrintTemplate from '../../components/PrintTemplate';
import XLSX from 'xlsx-js-style';

const SalesInvoices: React.FC = () => {
  const { currentCompany, companies, user, fiscalYear, minimizeModal, globalRefreshKey } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isGst = currentCompany?.is_gst_enabled === 1;
  const docLabel = isGst ? 'Invoice' : 'Bill';
  const docPlaceholder = isGst ? 'INV-0001/26' : 'CI-0001/26';
  const [invoices, setInvoices] = useState<any[]>([]);
  const invoicesRef = React.useRef<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [form] = Form.useForm();
  const [printData, setPrintData] = useState<any>(null);
  const passwordInputRef = React.useRef<any>(null);
  const lastPrintRecordRef = React.useRef<any>(null);

  useEffect(() => {
    if (deletePasswordModal) {
      setTimeout(() => {
        passwordInputRef.current?.select();
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [deletePasswordModal]);

  // Keep an always-fresh ref for Ctrl+P fallback selection.
  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);



  // Section permissions (Sales)
  const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const salesPerm: string = isAdminUser ? 'all' : (sectionPerms.sales || 'read');
  const canCreateOrEdit = isAdminUser || salesPerm === 'write' || salesPerm === 'edit' || salesPerm === 'all';
  const canEditOrDelete = isAdminUser || salesPerm === 'edit' || salesPerm === 'all';
  const isReadOnlySection = !isAdminUser && salesPerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      if (location.pathname === '/sales/invoices') {
        loadInvoices();
        loadCustomers();
        loadItems();
      } else if (invoices.length === 0) {
        loadInvoices();
        loadCustomers();
        loadItems();
      }
    }
  }, [currentCompany, location.pathname, fiscalYear, globalRefreshKey]);

  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<any>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [contentScale, setContentScale] = useState<number>(() => {
    const saved = localStorage.getItem('sales_invoice_scale');
    return saved ? parseFloat(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem('sales_invoice_scale', contentScale.toString());
  }, [contentScale]);
  const [printWithLetterhead, setPrintWithLetterhead] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (isPreviewVisible) {
          actualPrint();
          return;
        }
        const record = lastPrintRecordRef.current ?? invoicesRef.current?.[0];
        if (record) handlePrint(record);
        else message.warning('No invoices available to print.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewVisible]);

  const handleEdit = async (record: any) => {
    loadItems();
    loadCustomers();
    const hide = message.loading(`Fetching ${docLabel.toLowerCase()} details...`, 0);
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.getById(record.id);
      if (result.success && result.data) {
        const detailedInvoice = result.data;
        setEditingInvoice(detailedInvoice);
        setSelectedCustomerInfo(customers.find((c: any) => c.id === detailedInvoice.customer_id) || null);
        form.setFieldsValue({
          ...detailedInvoice,
          invoice_number: detailedInvoice.invoice_number,
          invoice_date: dayjs(detailedInvoice.invoice_date),
          due_date: detailedInvoice.due_date ? dayjs(detailedInvoice.due_date) : null,
        });
        setModalVisible(true);
      } else {
        notification.error({ message: 'Error', description: 'Failed to fetch details', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to fetch details', duration: 0 });
    } finally {
      hide();
    }
  };

  useEffect(() => {
    if (location.state?.editInvoiceId && customers.length > 0) {
      handleEdit({ id: location.state.editInvoiceId });
      // Clear state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, customers]);

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id);
      if (result.success) {
        setInvoices(filterRowsByOperationalFiscalYear(result.data || [], fiscalYear));
      }
    } catch (error) {
      notification.error({ message: 'Error', description: `Failed to load ${docLabel}s`, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
      if (result.success) {
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load customers');
    }
  };

  const loadItems = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
      if (result.success) {
        setItems(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load items');
    }
  };



  const handlePrint = async (record: any) => {
    try {
      lastPrintRecordRef.current = record;
      const result = await (window as any).electronAPI.db.salesInvoices.getById(record.id);
      if (result.success && result.data) {
        const data = result.data as any;
        const personName = data.customer_attention_person != null && String(data.customer_attention_person).trim() !== ''
          ? String(data.customer_attention_person).trim()
          : (data.attention_person != null && String(data.attention_person).trim() !== '' ? String(data.attention_person).trim() : '');
        setPrintData({
          ...data,
          person_name: personName,
        });
        setIsPreviewVisible(true);
      } else {
        notification.error({ message: 'Error', description: 'Failed to load invoice for print', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to prepare print', duration: 0 });
    }
  };

const actualPrint = () => {
  // Apply printing-specific CSS similar to PDF capture to ensure only the print container is rendered
  const body = document.body;
  body.classList.add('capturing-pdf');
  // Force a reflow to ensure styles are applied before invoking print
  void body.offsetHeight;
  setTimeout(async () => {
    try {
      // Use IPC print which returns a promise that resolves when dialog closes
      await (window as any).electronAPI.db.files.print();
    } catch (err) {
      console.error('IPC print failed, falling back to window.print():', err);
      window.print();
    } finally {
      // Clean up the class after printing completes
      body.classList.remove('capturing-pdf');
    }
  }, 300);
};

  const handleSavePDF = async () => {
    try {
      const customerName = printData?.customer_name ? printData.customer_name.trim() : 'Customer';
      const billNumber = printData?.invoice_number ? printData.invoice_number.trim() : 'Invoice';
      const cleanCustomer = customerName.replace(/[\\/:*?"<>|]/g, '_');
      const cleanBill = billNumber.replace(/[\\/:*?"<>|]/g, '_');
      const defaultName = `BILL_${cleanCustomer}_${cleanBill}.pdf`;
      // Step 1: show the save dialog BEFORE any visual change
      const pathResult = await (window as any).electronAPI.db.files.getSavePath(defaultName);
      if (!pathResult.success) return;

      // Step 2: apply capturing class (brief flash, dialog already gone)
      document.body.classList.add('capturing-pdf');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
      if (result.success) {
        message.success(`Saved to: ${result.filePath}`);
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to update invoice', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
    } finally {
      document.body.classList.remove('capturing-pdf');
    }
  };

  /*
  const loadNextInvoiceNumber = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id);
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const prefix = isGst ? 'INV' : 'CI';
        const regex = new RegExp(`${prefix}-(\\d+)\\/(\\d+)`);
        const invs = result.data
          .map((inv: any) => {
            const match = (inv.invoice_number || '').match(regex);
            if (match) {
              return { num: parseInt(match[1], 10), year: parseInt(match[2], 10) };
            }
            return null;
          })
          .filter(Boolean) as { num: number; year: number }[];

        if (invs.length > 0) {
          invs.sort((a, b) => (b.year - a.year) || (b.num - a.num));
          const latest = invs[0];
          const nextNum = latest.num + 1;
          const yearStr = String(latest.year).padStart(2, '0');
          form.setFieldsValue({
            invoice_number: `${prefix}-${String(nextNum).padStart(4, '0')}/${yearStr}`,
            invoice_date: dayjs(),
          });
          return;
        }
      }
      const prefix = isGst ? 'INV' : 'CI';
      const currentYear = fiscalYear || (new Date().getFullYear() % 100);
      form.setFieldsValue({
        invoice_number: `${prefix}-0001/${String(currentYear).padStart(2, '0')}`,
        invoice_date: dayjs(),
      });
    } catch (err) {
      console.error('Failed to load next invoice number:', err);
      form.setFieldsValue({ invoice_date: dayjs() });
    }
  };
  */




  const buildInvoiceData = (values: any) => {
    const invoiceData: any = {
      ...values,
      company_id: currentCompany!.id,
      is_gst_enabled: currentCompany!.is_gst_enabled,
      invoice_number: values.invoice_number?.trim?.() || undefined,
      fiscal_year: fiscalYear,
      invoice_date: values.invoice_date.format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      items: values.items || [],
      created_by: user?.id,
    };
    let subtotal = 0;
    let gstTotal = 0;
    invoiceData.items.forEach((item: any) => {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      // Flat 18% GST when company is GST-enabled; otherwise 0
      const rate = isGst ? 18 : 0;
      item.gst_rate = rate;
      const gstAmount = lineTotal * (rate / 100);
      gstTotal += gstAmount;
      item.gst_amount = gstAmount;
      item.line_total = lineTotal + gstAmount;
    });
    invoiceData.subtotal = subtotal;
    invoiceData.gst_total = gstTotal;
    invoiceData.total_amount = subtotal + gstTotal;
    invoiceData.balance = invoiceData.total_amount;
    return invoiceData;
  };

  const doSave = async (invoiceData: any) => {
    if (editingInvoice) {
      const result = await (window as any).electronAPI.db.salesInvoices.update(editingInvoice.id, invoiceData);
      if (result.success) message.success(`${docLabel} updated successfully`);
      else notification.error({ message: 'Error', description: result.error || `Failed to update ${docLabel.toLowerCase()}`, duration: 0 });
    } else {
      const result = await (window as any).electronAPI.db.salesInvoices.create(invoiceData);
      if (result.success) message.success(`${docLabel} ${result.data?.invoice_number || ''} created successfully`);
      else notification.error({ message: 'Error', description: result.error || `Failed to create ${docLabel.toLowerCase()}`, duration: 0 });
    }
    setModalVisible(false);
    setEditingInvoice(null);
    setSelectedCustomerInfo(null);
    form.resetFields();
    loadInvoices();
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const invoiceData = buildInvoiceData(values);

      // Credit limit check (skip when editing)
      if (!editingInvoice) {
        // Always fetch latest customer record to get up-to-date credit limit and balance
        let customer: any = customers.find((c: any) => c.id === values.customer_id);
        try {
          const fetched = await (window as any).electronAPI.db.customers.getById(values.customer_id);
          if (fetched?.success && fetched.data) {
            customer = fetched.data;
          }
        } catch {
          // If fetch fails, fall back to in-memory customer list
        }

        const limit = Number(customer?.credit_limit) || 0;
        const currentBalance = Number(customer?.balance) || 0;
        const invoiceTotal = Number(invoiceData.total_amount ?? 0);
        const newBalance = Math.round((currentBalance + invoiceTotal) * 100) / 100;

        if (limit > 0 && newBalance > limit + 0.01) {
          notification.error({
            message: 'Credit Limit Reached',
            description: `This ${docLabel.toLowerCase()} would exceed the customer's credit limit of ${limit.toLocaleString()}. Current balance: ${currentBalance.toLocaleString()}, New balance: ${newBalance.toLocaleString()}.`,
            duration: 0,
          });
          return;
        }
      }

      await doSave(invoiceData);
      loadInvoices();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
    }
  };

  const handleRequestDelete = (id: number) => {
    setPendingDeleteId(id);
    setAdminPassword('');
    setDeletePasswordModal(true);
  };

  const handleConfirmDelete = async () => {
        const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
        if (!verify.success || !verify.data) {
            notification.error({ message: 'Error', description: 'Incorrect admin password' });
            setAdminPassword('');
            return;
        }
    if (pendingDeleteId == null) return;
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.delete(pendingDeleteId);
      if (result.success) {
        message.success('Invoice deleted successfully');
        loadInvoices();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete invoice' });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete invoice' });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
    }
  };

  const handleDisableInvoice = async (id: number) => {
    try {
      const fetched = await (window as any).electronAPI.db.salesInvoices.getById(id);
      if (!fetched.success || !fetched.data) {
        notification.error({ message: 'Error', description: 'Failed to load invoice', duration: 0 });
        return;
      }
      const data = fetched.data;
      const result = await (window as any).electronAPI.db.salesInvoices.update(id, {
        ...data,
        status: 'cancelled',
      });
      if (result.success) {
        message.success('Invoice disabled');
        loadInvoices();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to disable invoice', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to disable invoice', duration: 0 });
    }
  };

  const getOverdueStatusTag = (record: any) => {
    if (record.status === 'cancelled') return null;
    const balance = Number(record.balance) || 0;
    if (balance <= 0) return <Tag color="green">Paid</Tag>;

    const invoiceDateStr = record.invoice_date;
    if (!invoiceDateStr) return null;

    const termsDays = record.customer_payment_terms_days !== undefined ? Number(record.customer_payment_terms_days) : 30;
    const invoiceDate = dayjs(invoiceDateStr);
    const today = dayjs().startOf('day');
    
    // Difference in calendar days
    const daysDiff = today.diff(invoiceDate.startOf('day'), 'day');
    
    if (daysDiff >= termsDays) {
      const overdueDays = daysDiff - termsDays;
      return (
        <Tag color="red" icon={<WarningOutlined />}>
          {overdueDays === 0 ? 'Overdue Today' : `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`}
        </Tag>
      );
    } else if (daysDiff === termsDays - 1) {
      return (
        <Tag color="yellow" style={{ color: '#ad8b00', borderColor: '#ffe58f', backgroundColor: '#fffbe6' }} icon={<WarningOutlined />}>
          Overdue Tomorrow
        </Tag>
      );
    } else if (daysDiff >= termsDays - 3) {
      const daysLeft = termsDays - daysDiff;
      return (
        <Tag color="orange" icon={<WarningOutlined />}>
          Overdue in {daysLeft} day{daysLeft > 1 ? 's' : ''}
        </Tag>
      );
    }

    const daysRemaining = termsDays - daysDiff;
    return <Tag color="blue">{daysRemaining} days left</Tag>;
  };

  const columns = [
    {
      title: `${docLabel} #`,
      dataIndex: 'invoice_number',
      key: 'invoice_number',
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
    },
    {
      title: 'Due Status',
      key: 'due_status',
      render: (_: any, record: any) => getOverdueStatusTag(record),
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => (
        <span style={{ color: balance > 0 ? '#f5222d' : '#52c41a', fontWeight: 'bold' }}>
          {balance.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        if (record.status === 'cancelled') {
          return <Tag color="red">Disabled</Tag>;
        }
        // Read-only users: allow only viewing/printing
        if (isReadOnlySection) {
          return (
            <Space>
              <Button
                icon={<EyeOutlined />}
                onClick={() => handlePrint(record)}
                title={`View ${docLabel}`}
              />
            </Space>
          );
        }
        // Users with write/edit/all: full actions
        return (
          <Space>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record)}
              title={`Print ${docLabel}`}
            />
            {canCreateOrEdit && (
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            )}
            {canEditOrDelete && (
              <>
                <Popconfirm
                  title={`Are you sure you want to disable this ${docLabel.toLowerCase()}? This cannot be undone.`}
                  onConfirm={() => handleDisableInvoice(record.id)}
                  okText="Yes, Disable"
                  cancelText="Cancel"
                >
                  <Button icon={<StopOutlined />} title="Disable" />
                </Popconfirm>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRequestDelete(record.id)}
                  title={`Delete ${docLabel}`}
                />
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = invoices.filter(inv =>
    (inv.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportExcelSingle = () => {
    if (!printData) return;
    
    const company = (companies || []).find((c: any) => c.id === printData.company_id) || currentCompany;

    const wb = XLSX.utils.book_new();

    // Define styles
    const titleStyle = { font: { bold: true, size: 16 } };
    const labelStyle = { font: { bold: true } };
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "333333" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        }
    };
    const itemStyle = {
        alignment: { vertical: "center" },
        border: {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" }
        }
    };
    const numberStyle = { ...itemStyle, alignment: { horizontal: "right", vertical: "center" } };
    const footerStyle = { font: { bold: true }, alignment: { horizontal: "right" } };

    const wsData: any[][] = [
        [{ v: docLabel.toUpperCase(), s: titleStyle }],
        [],
        [{ v: 'Company:', s: labelStyle }, company?.name || ''],
        [{ v: 'Date:', s: labelStyle }, dayjs(printData.invoice_date).format('DD/MM/YYYY')],
        [{ v: `${docLabel} #:`, s: labelStyle }, printData.invoice_number],
        [{ v: 'PO #:', s: labelStyle }, printData.dc_po_number || printData.po_number || ''],
        [{ v: 'Customer:', s: labelStyle }, printData.customer_name || ''],
        [],
        [
            { v: 'S.No', s: headerStyle },
            { v: 'Brand', s: headerStyle },
            { v: 'Item', s: headerStyle },
            { v: 'Description', s: headerStyle },
            { v: 'Qty', s: headerStyle },
            { v: 'Unit Price', s: headerStyle },
            { v: 'Total', s: headerStyle }
        ]
    ];

    // Add items
    (printData.items || []).forEach((it: any, index: number) => {
        wsData.push([
            { v: index + 1, s: itemStyle },
            { v: it.brand || '', s: itemStyle },
            { v: it.item_name || '', s: itemStyle },
            { v: it.description || '', s: itemStyle },
            { v: it.quantity || 0, s: numberStyle },
            { v: it.unit_price || 0, s: numberStyle },
            { v: (it.quantity || 0) * (it.unit_price || 0), s: numberStyle }
        ]);
    });

    // Add footer
    wsData.push([]);
    wsData.push([
        '', '', '', '', '', 
        { v: 'Total Amount:', s: footerStyle }, 
        { v: printData.total_amount || 0, s: { ...footerStyle, alignment: { horizontal: "right" } } }
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 15 }, // Brand
        { wch: 25 }, // Item
        { wch: 40 }, // Description
        { wch: 10 }, // Qty
        { wch: 12 }, // Unit Price
        { wch: 15 }  // Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, docLabel);
    XLSX.writeFile(wb, `${printData.invoice_number}.xlsx`);
    message.success('Exported to Excel');
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Sales {docLabel}s</h1>
          <Input
            placeholder={`Search by ${docLabel.toLowerCase()} # or customer...`}
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>Create a {docLabel.toLowerCase()} from a Delivery Challan (Delivery Challans page).</p>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredInvoices}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingInvoice ? `Edit ${docLabel}` : `New ${docLabel}`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingInvoice(null);
          setSelectedCustomerInfo(null);
          form.resetFields();
        }}
        maskClosable={true}
        onOk={() => form.submit()}
        width={900}
        closeIcon={
          <Space size="middle">
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                const invNum = form.getFieldValue('invoice_number') || `New ${docLabel}`;
                setModalVisible(false);
                minimizeModal({
                  id: editingInvoice ? `inv-edit-${editingInvoice.id}` : 'inv-new',
                  title: editingInvoice ? `Edit ${docLabel} ${invNum}` : `New ${docLabel} ${invNum}`,
                  onRestore: () => {
                    loadItems();
                    loadCustomers();
                    setEditingInvoice(editingInvoice);
                    setModalVisible(true);
                  }
                });
              }}
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={(e) => {
              e.stopPropagation(); // Prevent triggering onCancel (minimization)
              setModalVisible(false);
              setEditingInvoice(null);
              setSelectedCustomerInfo(null);
              form.resetFields();
            }} />
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Space align="start">
            <Form.Item name="invoice_number" label={`${docLabel} #`} rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder={`e.g. ${docPlaceholder}`} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="po_number" label="PO #" style={{ marginBottom: 16 }}>
              <Input placeholder="PO Number" style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => {
                const c = customers.find((x: any) => x.id === val);
                setSelectedCustomerInfo(c || null);
                
                // Automatically calculate and set Due Date based on customer's payment_terms_days
                const invoiceDate = form.getFieldValue('invoice_date');
                if (invoiceDate && c) {
                  const termsDays = c.payment_terms_days !== undefined ? Number(c.payment_terms_days) : 30;
                  const calculatedDueDate = dayjs(invoiceDate).add(termsDays, 'day');
                  form.setFieldsValue({ due_date: calculatedDueDate });
                }
              }}
              options={customers.map((c: any) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          {selectedCustomerInfo && (() => {
            const limit   = Number(selectedCustomerInfo.credit_limit) || 0;
            const balance = Number(selectedCustomerInfo.balance)      || 0;
            if (limit <= 0) return null;
            const used    = Math.max(balance, 0);
            const pct     = Math.min(Math.round((used / limit) * 100), 100);
            const over    = balance > limit;
            const near    = !over && pct >= 80;
            return (
              <Alert
                style={{ marginBottom: 12 }}
                type={over ? 'error' : near ? 'warning' : 'info'}
                showIcon
                message={
                  <span>
                    <strong>Credit Status — {selectedCustomerInfo.name}</strong>
                    {over && <Tag color="red" style={{ marginLeft: 8 }}>LIMIT EXCEEDED</Tag>}
                    {near && !over && <Tag color="orange" style={{ marginLeft: 8 }}>NEAR LIMIT</Tag>}
                  </span>
                }
                description={
                  <div>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 6, fontSize: 13 }}>
                      <span>Balance: <strong style={{ color: over ? '#cf1322' : undefined }}>{balance.toLocaleString()}</strong></span>
                      <span>Credit Limit: <strong>{limit.toLocaleString()}</strong></span>
                      <span>Available: <strong style={{ color: over ? '#cf1322' : '#389e0d' }}>{Math.max(limit - balance, 0).toLocaleString()}</strong></span>
                    </div>
                    <Progress
                      percent={pct}
                      size="small"
                      strokeColor={over ? '#cf1322' : near ? '#faad14' : '#1890ff'}
                      format={(p) => `${p}% used`}
                    />
                  </div>
                }
              />
            );
          })()}
          <Space>
            <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
              <DatePicker onChange={(date) => {
                if (date && selectedCustomerInfo) {
                  const termsDays = selectedCustomerInfo.payment_terms_days !== undefined ? Number(selectedCustomerInfo.payment_terms_days) : 30;
                  const calculatedDueDate = dayjs(date).add(termsDays, 'day');
                  form.setFieldsValue({ due_date: calculatedDueDate });
                }
              }} />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="draft">
              <Select>
                <Select.Option value="draft">Draft</Select.Option>
                <Select.Option value="finalized">Finalized</Select.Option>
              </Select>
            </Form.Item>
          </Space>
          <Form.List
            name="items"
            rules={[
              {
                validator: async (_, names) => {
                  if (!names || names.length < 1) {
                    return Promise.reject(new Error('At least one item is required'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'item_id']}
                      rules={[{ required: true, message: 'Select item' }]}
                    >
                      <Select
                        placeholder="Item"
                        style={{ width: 220 }}
                        onChange={(value) => {
                          const item = items.find(i => i.id === value);
                          // Flat 18% GST when GST is enabled; otherwise 0
                          const gstRate = isGst ? 18 : 0;
                          if (item) {
                            const currentItems = form.getFieldValue('items');
                            currentItems[name] = {
                              ...currentItems[name],
                              description: item.description || '',
                              brand: item.brand_name || '',
                              unit_price: item.selling_price,
                              gst_rate: gstRate,
                            };
                            form.setFieldsValue({ items: currentItems });
                          }
                        }}
                      >
                        {items.map(item => (
                          <Select.Option key={item.id} value={item.id}>
                            {item.name} ({item.code})
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']}>
                      <Input placeholder="Description" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'brand']}>
                      <Input placeholder="Brand" style={{ width: 100 }} />
                    </Form.Item>
                     <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: 'Quantity' }]}
                    >
                      <InputNumber placeholder="Qty" min={0} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unit_price']}
                      rules={[{ required: true, message: 'Price' }]}
                    >
                      <InputNumber placeholder="Price" min={0} />
                    </Form.Item>

                    <Button onClick={() => remove(name)}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add Item
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
                </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Admin password required"
        open={deletePasswordModal}
        onCancel={() => {
          setDeletePasswordModal(false);
          setPendingDeleteId(null);
          setAdminPassword('');
        }}
        onOk={handleConfirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Enter admin password to delete this {docLabel.toLowerCase()}:</p>
        <Input.Password
          prefix={<LockOutlined />}
          value={adminPassword}
          onChange={e => setAdminPassword(e.target.value)}
          placeholder="Admin password"
          onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
        ref={passwordInputRef}
        autoFocus
        />
      </Modal>

      <Modal
        title="Print Preview"
        open={isPreviewVisible}
        onCancel={() => {
          setIsPreviewVisible(false);
          setPrintData(null);
        }}
        width={900}
        maskClosable={true}
        footer={[
          <Button key="cancel" onClick={() => setIsPreviewVisible(false)}>
            Close
          </Button>,
          <Button key="excel" onClick={handleExportExcelSingle}>
            Export to Excel
          </Button>,
          <Button
            key="pdf"
            icon={<PrinterOutlined />}
            onClick={handleSavePDF}
          >
            Save as PDF
          </Button>,
          <Button key="print" type="primary" onClick={actualPrint}>
            Print
          </Button>,
        ]}
        className="print-preview-modal"
        closeIcon={
          <Space>
            <MinusSquareOutlined
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                const preview = printData;
                const restoreLetterhead = printWithLetterhead;
                const restoreScale = contentScale;
                setIsPreviewVisible(false);
                setPrintData(null);
                minimizeModal({
                  id: preview?.id != null ? `print-inv-${preview.id}` : 'print-inv',
                  title: preview?.invoice_number ? `Print ${docLabel} ${preview.invoice_number}` : `Print ${docLabel}`,
                  returnPath: location.pathname,
                  onRestore: () => {
                    setPrintWithLetterhead(restoreLetterhead);
                    setContentScale(restoreScale);
                    setPrintData(preview);
                    setIsPreviewVisible(true);
                  },
                });
              }}
            />
            <CloseOutlined
              style={{ fontSize: 18 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewVisible(false);
                setPrintData(null);
              }}
            />
          </Space>
        }
      >
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span>Scale:</span>
          <Select value={contentScale} onChange={v => setContentScale(v)} style={{ width: 100 }} options={[{ value: 0.5, label: '50%' }, { value: 0.6, label: '60%' }, { value: 0.7, label: '70%' }, { value: 0.8, label: '80%' }, { value: 0.9, label: '90%' }, { value: 1, label: '100%' }]} />
          <span>Letterhead:</span>
          <Switch
            checked={printWithLetterhead}
            onChange={setPrintWithLetterhead}
            checkedChildren="With"
            unCheckedChildren="Without"
          />
        </div>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
          <div className="preview-page-wrapper">
            {printData && (
              <PrintTemplate
                type={isGst ? 'invoice' : 'bill'}
                data={printData}
                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                withLetterhead={printWithLetterhead}
                contentScale={contentScale}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Hidden print container — revealed by @media print CSS for PDF/Print capture */}
      <div id="print-container">
        {printData && (
          <PrintTemplate
            type={isGst ? 'invoice' : 'bill'}
            data={printData}
            company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
            withLetterhead={printWithLetterhead}
            contentScale={contentScale}
          />
        )}
      </div>

    </div>
  );
};

export default SalesInvoices;
