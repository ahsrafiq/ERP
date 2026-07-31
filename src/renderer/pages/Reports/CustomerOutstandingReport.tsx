import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Table, Button, Space, Typography, Input, notification, Tag, Select, Divider, message } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { Title, Text } = Typography;

const CustomerOutstandingReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const [searchTrigger, setSearchTrigger] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCustomerId]);

  useEffect(() => {
    if (!currentCompany) return;
    void (async () => {
      setLoading(true);
      try {
        const [custRes, invRes] = await Promise.all([
          (window as any).electronAPI.db.customers.getAll(currentCompany.id),
          (window as any).electronAPI.db.salesInvoices.getPendingWithItems(currentCompany.id)
        ]);

        if (custRes?.success) setCustomers(custRes.data || []);
        else setCustomers([]);

        if (invRes?.success) {
          setInvoices(invRes.data || []);
        } else {
          setInvoices([]);
        }
      } catch {
        notification.error({ message: 'Error', description: 'Failed to load report data', duration: 0 });
        setCustomers([]);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentCompany]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return invoices
      .filter((inv: any) => (selectedCustomerId ? Number(inv.customer_id) === Number(selectedCustomerId) : true))
      .filter((inv: any) => {
        if (!q) return true;
        return (
          (inv.invoice_number || '').toLowerCase().includes(q) ||
          (inv.customer_name || '').toLowerCase().includes(q) ||
          (inv.po_number || '').toLowerCase().includes(q)
        );
      });
    // We include searchTrigger to allow manual re-calc if needed, though useMemo is reactive to others
  }, [invoices, searchQuery, selectedCustomerId, searchTrigger]);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
  }, [filteredInvoices]);

  const visibleInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredInvoices.slice(start, end);
  }, [filteredInvoices, currentPage, pageSize]);

  const visibleTotalOutstanding = useMemo(() => {
    return visibleInvoices.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
  }, [visibleInvoices]);

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  const handleSavePDF = async () => {
    try {
      const fileName = `Customer_Outstanding_Report_${dayjs().format('YYYY-MM-DD')}.pdf`;
      const pathResult = await (window as any).electronAPI.db.files.getSavePath(fileName);
      if (!pathResult.success) return;

      document.body.classList.add('capturing-pdf');
      const pc = document.getElementById('report-pdf-container');
      if (pc) pc.style.display = 'block';

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const res = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
      
      if (res.success) {
        message.success(`Saved to: ${res.filePath}`);
      } else {
        notification.error({ message: 'Error', description: res.error || 'Failed to save PDF', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
    } finally {
      document.body.classList.remove('capturing-pdf');
      const pc = document.getElementById('report-pdf-container');
      if (pc) pc.style.display = 'none';
    }
  };

  const pdfColumns = useMemo(() => [
    { title: 'Date', dataIndex: 'invoice_date', align: 'left' as const, render: (v: string) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Invoice #', dataIndex: 'invoice_number', align: 'left' as const },
    { title: 'Customer', dataIndex: 'customer_name', align: 'left' as const },
    { title: 'PO #', dataIndex: 'po_number', align: 'left' as const, render: (v: string) => v || '—' },
    { title: currentCompany?.is_gst_enabled ? 'Amount (incl GST)' : 'Amount', dataIndex: 'total_amount', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Balance Due', dataIndex: 'balance', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Overdue', dataIndex: 'due_date', align: 'center' as const, render: (v: string) => {
        if (!v) return '—';
        const due = dayjs(v);
        const diff = dayjs().diff(due, 'days');
        return diff > 0 ? `${diff} Days` : 'Not Due';
      }
    }
  ], [currentCompany]);

  const pdfSummaryRow = useMemo(() => (
    <tr className="erp-report-pdf-total-row">
      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Outstanding</td>
      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#cf1322' }}>{totalOutstanding.toLocaleString()}</td>
      <td></td>
    </tr>
  ), [totalOutstanding]);

  const itemColumns = [
    { title: 'Item', dataIndex: 'item_name', render: (v: string, r: any) => v || r.description || '-' },
    { title: 'Brand', dataIndex: 'brand' },
    { title: 'Qty', dataIndex: 'quantity', align: 'right' as const },
    { title: 'Rate', dataIndex: 'unit_price', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Total', dataIndex: 'line_total', align: 'right' as const, render: (v: number) => <strong>{Number(v || 0).toLocaleString()}</strong> },
  ];

  const columns = [
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD-MMM-YYYY')
    },
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 140,
      render: (v: string) => <Text strong>{v}</Text>
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (v: string) => <Text>{v}</Text>
    },
    {
      title: 'PO #',
      dataIndex: 'po_number',
      key: 'po_number',
      render: (v: string) => v || '—'
    },
    {
      title: currentCompany?.is_gst_enabled ? 'Amount (incl GST)' : 'Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString()
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#cf1322', fontWeight: 700 }}>{Number(v || 0).toLocaleString()}</span>
    },
    {
      title: 'Overdue',
      key: 'overdue',
      width: 120,
      render: (_: any, inv: any) => {
        if (!inv?.due_date) return '—';
        const due = dayjs(inv.due_date);
        const diff = dayjs().diff(due, 'days');
        return diff > 0 ? <Tag color="error">{diff} Days</Tag> : <Tag color="success">Not Due</Tag>;
      }
    }
  ];



  const expandedRowRender = (record: any) => {
    return (
      <Table
        columns={itemColumns}
        dataSource={record.items}
        pagination={false}
        size="small"
        rowKey="id"
        style={{ margin: '8px 0', backgroundColor: '#f9f9f9', border: '1px solid #f0f0f0', borderRadius: 4 }}
      />
    );
  };

  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Customer Outstanding — {currentCompany?.name}</Title>
          </Space>
          <Space size="middle">
            <Select
              allowClear
              showSearch
              placeholder="All customers"
              style={{ width: 280 }}
              value={selectedCustomerId ?? undefined}
              onChange={(value) => setSelectedCustomerId(value ?? null)}
              optionFilterProp="label"
              options={customers
  .filter((c: any) => Number(c.balance) > 0 || invoices.some((inv: any) => Number(inv.customer_id) === Number(c.id)))
  .map((c: any) => ({
    value: c.id,
    label: `${c.name || 'Customer'}${c.code ? ` (${c.code})` : ''}`,
  }))}
            />
            <Input
              allowClear
              value={searchQuery}
              placeholder="Search Invoice #, Customer, PO #"
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              Search
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              disabled={filteredInvoices.length === 0}
            >
              Print
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handleSavePDF}
              disabled={filteredInvoices.length === 0}
            >
              Save as PDF
            </Button>
          </Space>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Total Outstanding Items</div>
            <div style={{ fontWeight: 800, color: '#cf1322', fontSize: 18 }}>{totalOutstanding.toLocaleString()}</div>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Count</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{filteredInvoices.length} Invoices</div>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>As on</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{dayjs().format('DD-MMM-YYYY')}</div>
          </div>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Customer Outstanding Report</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>
          As on: {dayjs().format('DD-MMM-YYYY')}
        </Text>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text>Total Outstanding: <strong style={{ color: '#cf1322' }}>{totalOutstanding.toLocaleString()}</strong></Text>
          <Text>Invoices: <strong>{filteredInvoices.length}</strong></Text>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredInvoices}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          showSizeChanger: true,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          }
        }}
        expandable={{
          expandedRowRender,
          defaultExpandAllRows: true
        }}
        scroll={{ x: 1000 }}
        bordered
      />

      {/* PDF Capture container */}
      {createPortal(
        <div id="report-pdf-container" style={{ display: 'none' }}>
          <ReportTablePdfDocument
            reportTitle="Customer Outstanding Report"
            companyName={currentCompany?.name || '-'}
            periodLabel={`As on: ${dayjs().format('DD-MMM-YYYY')}`}
            columns={pdfColumns}
            data={filteredInvoices}
            summaryRow={pdfSummaryRow}
            footerNote={`Generated on ${dayjs().format('DD-MMM-YYYY HH:mm')}`}
            hidePageNumbers={true}
          />
        </div>,
        document.body
      )}

      <style>{`
        body.capturing-pdf #root {
          display: none !important;
        }
        @media print {
          #root {
            display: none !important;
          }
          #report-pdf-container,
          #report-pdf-container * {
            visibility: visible !important;
          }
          #report-pdf-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: auto !important;
            background: white !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
};

export default CustomerOutstandingReport;

