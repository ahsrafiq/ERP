import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Select, Button, Space,
  Statistic, Divider, Typography, notification, message, Empty, Tag, Avatar,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  UserOutlined, DollarOutlined, FileTextOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import {
  ReportLedgerPdfDocument,
  formatLedgerPaymentTransType,
  type ReportLedgerPdfRow,
} from '../../components/ReportPdf/ReportLedgerPdfDocument';

const { Title, Text } = Typography;

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  po_number?: string;
  reference: string;
  customer_name?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  taxDeductionRate?: number;
  taxDeductionAmount?: number;
  personnel?: string;
  payment_method?: string | null;
}

const CustomerLedgerReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentCompany) loadCustomers();
  }, [currentCompany]);

  useEffect(() => {
    setLedger([]);
    setCustomerInfo(null);
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    try {
      const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
      if (res.success) setCustomers(res.data || []);
    } catch { /* ignore */ }
  };

  const loadLedger = async () => {
    setLoading(true);
    setLedger([]);
    try {
      const customer = selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) : null;
      setCustomerInfo(customer);

      // Load invoices, payments, and users (for Personnel column on PDFs)
      const [invRes, payRes, usersRes] = await Promise.all([
        (window as any).electronAPI.db.salesInvoices.getAll(currentCompany!.id, {}),
        (window as any).electronAPI.db.payments.getAll(currentCompany!.id, { type: 'in' }),
        (window as any).electronAPI.db.users.getAll(currentCompany!.id),
      ]);

      let invoices = (invRes.success ? invRes.data : []) || [];
      if (selectedCustomerId) {
        invoices = invoices.filter((inv: any) => inv.customer_id === selectedCustomerId);
      }

      // Apply Overdue filter if requested
      if (overdueOnly) {
        const today = dayjs().format('YYYY-MM-DD');
        invoices = invoices.filter((inv: any) => 
          inv.status !== 'paid' && 
          inv.due_date && 
          inv.due_date < today
        );
      }

      let payments = (payRes.success ? payRes.data : []) || [];
      if (selectedCustomerId) {
        payments = payments.filter((p: any) => p.customer_id === selectedCustomerId);
      }

      const userMap: Record<number, string> = {};
      if (usersRes?.success && Array.isArray(usersRes.data)) {
        for (const u of usersRes.data) {
          const id = Number(u.id);
          if (id) userMap[id] = (u.full_name && String(u.full_name).trim()) || u.username || '—';
        }
      }

      // Combine into unified ledger entries
      const entries: Omit<LedgerEntry, 'balance'>[] = [
        ...invoices.map((inv: any) => ({
          id: `inv-${inv.id}`,
          date: inv.invoice_date,
          type: 'invoice' as const,
          po_number: inv.po_number || '',
          reference: inv.invoice_number,
          customer_name: inv.customer_name,
          description: `Sales Invoice${inv.due_date ? ` (Due: ${dayjs(inv.due_date).format('DD-MM-YYYY')})` : ''}`,
          debit: Number(inv.total_amount) || 0,
          credit: 0,
          personnel: userMap[Number(inv.created_by)] || '—',
        })),
        ...(!overdueOnly ? payments.map((p: any) => ({
          id: `pay-${p.id}`,
          date: p.payment_date,
          type: 'payment' as const,
          po_number: selectedCustomerId ? (customer?.po_number || '') : '',
          reference: p.payment_number,
          customer_name: p.customer_name,
          description: `Payment Received (Net)${p.payment_method ? ` (${p.payment_method})` : ''}${p.notes ? ' — ' + p.notes : ''}`,
          debit: 0,
          credit: Number(p.amount) || 0,
          taxDeductionRate: Number(p.tax_deduction_rate) || 0,
          taxDeductionAmount: Number(p.tax_deduction) || 0,
          personnel: userMap[Number(p.created_by)] || '—',
          payment_method: p.payment_method,
        })) : []),
      ];

      // Sort by date ascending, then by type (invoice before payment on same day)
      entries.sort((a, b) => {
        const dateDiff = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
        if (dateDiff !== 0) return dateDiff;
        if (a.type === 'invoice' && b.type === 'payment') return -1;
        if (a.type === 'payment' && b.type === 'invoice') return 1;
        return 0;
      });

      // Calculate running balance
      let runningBalance = 0;
      const ledgerRows: LedgerEntry[] = entries.map((entry) => {
        // Balance = Previous + Debit - (Credit + Tax)
        // For payments, credit is net amount, taxDeductionAmount is withheld tax
        const creditImpact = (entry.credit || 0) + (entry.taxDeductionAmount || 0);
        runningBalance += (entry.debit || 0) - creditImpact;
        return { ...entry, balance: runningBalance } as LedgerEntry;
      });

      setLedger(ledgerRows);
    } catch (err) {
      console.error('Ledger Load Error:', err);
      notification.error({ message: 'Error', description: 'Failed to load ledger', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const totalDebit   = ledger.reduce((s, r) => s + r.debit,  0);
  const totalCredit  = ledger.reduce((s, r) => s + r.credit, 0);
  const closingBal   = totalDebit - totalCredit;
  const invoiceCount = ledger.filter((r) => r.type === 'invoice').length;
  const paymentCount = ledger.filter((r) => r.type === 'payment').length;

  const columns = [
    { title: 'Sr.',       key: 'sr',          width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Date',      dataIndex: 'date',  key: 'date', render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '—' },
    ...(selectedCustomerId ? [] : [{ title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' }]),
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (t: string) => t === 'invoice'
        ? <Tag color="blue">Invoice</Tag>
        : <Tag color="green">Payment</Tag>,
    },
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number', render: (v: string) => v ? v : '—' },
    { title: 'Reference', dataIndex: 'reference',   key: 'reference', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Debit (Invoice)',
      dataIndex: 'debit', key: 'debit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#cf1322', fontSize: '12px' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary" style={{ fontSize: '12px' }}>—</Text>,
    },
    {
      title: 'Credit (Payment)',
      dataIndex: 'credit', key: 'credit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#389e0d', fontSize: '12px' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary" style={{ fontSize: '12px' }}>—</Text>,
    },
    {
      title: 'Tax Ded %',
      dataIndex: 'taxDeductionRate', key: 'taxDeductionRate', align: 'right' as const,
      render: (v: number, row: LedgerEntry) => row.type === 'payment' && v ? `${v}%` : '—',
    },
    {
      title: 'Tax Ded Amt',
      dataIndex: 'taxDeductionAmount', key: 'taxDeductionAmount', align: 'right' as const,
      render: (v: number, row: LedgerEntry) => row.type === 'payment' && v ? <Text style={{ color: '#fa8c16' }}>{Number(v).toLocaleString()}</Text> : '—',
    },
    {
      title: 'Balance',
      dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ fontSize: '12px' }} type={v > 0 ? 'danger' : v < 0 ? 'success' : undefined}>
          {Number(v).toLocaleString()}
        </Text>
      ),
    },
  ];

  const handleSavePDF = async () => {
    try {
      const fileName = `Customer_Ledger_${customerInfo?.name || 'All'}.pdf`;
      const pathResult = await (window as any).electronAPI.db.files.getSavePath(fileName);
      if (!pathResult.success) return;

      document.body.classList.add('capturing-pdf');
      // Ensure the report is visible in the print container
      const printContainer = document.getElementById('print-container');
      if (printContainer) {
          printContainer.style.display = 'block';
      }

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
      
      if (result.success) {
        message.success(`Saved to: ${result.filePath}`);
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to save PDF', duration: 0 });
      }
    } catch (err) {
      notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
    } finally {
      document.body.classList.remove('capturing-pdf');
      const printContainer = document.getElementById('print-container');
      if (printContainer) {
          printContainer.style.display = 'none';
      }
    }
  };

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={selectedCustomerId ? 6 : 7} align="right"><Text strong>Total</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right"><Text style={{ color: '#cf1322' }} strong>{totalDebit.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={2} align="right"><Text style={{ color: '#389e0d' }} strong>{totalCredit.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={3} colSpan={2} align="right" />
        <Table.Summary.Cell index={4} align="right"><Text strong type={closingBal > 0 ? 'danger' : closingBal < 0 ? 'success' : undefined}>{closingBal.toLocaleString()}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  const handleExportExcel = () => {
    if (ledger.length === 0) return;
    const companyName = currentCompany?.name || 'Company';
    const custName    = customerInfo?.name || 'All Customers';
    const dateStr     = new Date().toLocaleDateString('en-GB');

    const thin  = { top: { style: 'thin', color: { rgb: 'AAAAAA' } }, bottom: { style: 'thin', color: { rgb: 'AAAAAA' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } };
    const thick = { ...thin, bottom: { style: 'medium', color: { rgb: '000000' } } };

    const sTitle  = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const sSub    = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
    const sMeta   = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
    const sHdr    = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F5496' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
    const sHdrR   = { ...sHdr, alignment: { horizontal: 'right', vertical: 'center' } };
    const sData   = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thin };
    const sDataR  = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDebit  = { font: { sz: 10, color: { rgb: 'C00000' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sCred   = { font: { sz: 10, color: { rgb: '375623' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sBal    = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sTot    = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thick };
    const sSumL   = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thin };
    const sSumV   = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };

    const c = (v: any, s: any = {}) => ({ v, s });
    
    // Define columns based on whether a specific customer is selected
    const hasCust = !!selectedCustomerId;
    const numCols = hasCust ? 9 : 10;

    const colHdrs = [
      c('Sr.', sHdr), 
      c('Date', sHdr), 
      ...(hasCust ? [] : [c('Customer', sHdr)]),
      c('Type', sHdr), 
      c('PO Number', sHdr),
      c('Reference', sHdr),
      c('Description', sHdr), 
      c('Debit (Invoice)', sHdrR), 
      c('Credit (Payment)', sHdrR), 
      c('Balance', sHdrR),
    ];

    const dataRows = ledger.map((row, i) => [
      c(i + 1,                                     sData),
      c(row.date ? dayjs(row.date).format('DD-MM-YYYY') : '', sData),
      ...(hasCust ? [] : [c(row.customer_name || '—', sData)]),
      c(row.type === 'invoice' ? 'Invoice' : 'Payment', sData),
      c(row.po_number || '',                        sData),
      c(row.reference,                             sData),
      c(row.description,                           sData),
      c(row.debit  > 0 ? row.debit  : '',          row.debit  > 0 ? sDebit : sDataR),
      c(row.credit > 0 ? row.credit : '',          row.credit > 0 ? sCred  : sDataR),
      c(row.balance,                               sBal),
    ]);

    const totalsRow = [
      c('', sTot), c('', sTot), ...(hasCust ? [] : [c('', sTot)]), c('', sTot), c('', sTot), c('', sTot), c('TOTAL', sTot),
      c(totalDebit, sTot), c(totalCredit, sTot), c(closingBal, sTot),
    ];

    const summaryRows: any[][] = [
      [],
      [c('Summary', { font: { bold: true, sz: 11 } })],
      [c('Customer',         sSumL), c(''), c(''), c(custName,      sSumV)],
      [c('Total Invoices',   sSumL), c(''), c(''), c(invoiceCount,  sSumV)],
      [c('Total Payments',   sSumL), c(''), c(''), c(paymentCount,  sSumV)],
      [c('Total Debits',     sSumL), c(''), c(''), c(totalDebit,    sSumV)],
      [c('Total Credits',    sSumL), c(''), c(''), c(totalCredit,   sSumV)],
      [c('Closing Balance',  sSumL), c(''), c(''), c(closingBal,    sSumV)],
    ];

    const wsData: any[][] = [
      [c(companyName, sTitle)],
      [c('Customer Ledger', sSub)],
      [c(`Customer: ${custName}  |  Generated: ${dateStr}`, sMeta)],
      [],
      colHdrs,
      ...dataRows,
      totalsRow,
      ...summaryRows,
    ];

    const ws: any = XLSXStyle.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
    ];
    
    ws['!cols'] = hasCust ? [
      { wch: 8 }, { wch: 13 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    ] : [
      { wch: 8 }, { wch: 13 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    ];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Customer Ledger');
    XLSXStyle.writeFile(wb, `Customer_Ledger_${custName.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const pdfRows: ReportLedgerPdfRow[] = ledger.map((r) => ({
    date: r.date ? dayjs(r.date).format('DD.MM.YYYY') : '-',
    transType: r.type === 'invoice' ? 'Invoice' : formatLedgerPaymentTransType(r.payment_method),
    poNumber: r.po_number || '-',
    invRef: r.reference ? `Inv # ${r.reference}` : '-',
    debit: r.debit > 0 ? Number(r.debit).toLocaleString() : '-',
    credit: r.credit > 0 ? Number(r.credit).toLocaleString() : '-',
    balance: Number(r.balance || 0).toLocaleString(),
  }));
  const dateFromLabel = ledger.length > 0 ? dayjs(ledger[0].date).format('DD-MMM-YYYY') : '-';
  const dateToLabel = ledger.length > 0 ? dayjs(ledger[ledger.length - 1].date).format('DD-MMM-YYYY') : '-';

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Customer Ledger — {currentCompany?.name}</Title>
          </Space>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#217346', borderColor: '#217346' }}
              disabled={ledger.length === 0}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button icon={<PrinterOutlined />} disabled={ledger.length === 0} onClick={handleSavePDF}>
              Save as PDF
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} disabled={ledger.length === 0} onClick={() => window.print()}>
              Print
            </Button>
          </Space>
        </div>

        {/* Customer selector */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap align="center">
            <UserOutlined style={{ fontSize: 16 }} />
            <Text strong>Select Customer:</Text>
            <Select
              showSearch
              placeholder="Choose a customer to view ledger…"
              style={{ width: 320 }}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              optionFilterProp="label"
              options={customers.map((c: any) => ({ label: `${c.name}${c.code ? ' (' + c.code + ')' : ''}`, value: c.id }))}
              allowClear
            />
            <Button
              type={overdueOnly ? 'primary' : 'default'}
              danger={overdueOnly}
              onClick={() => setOverdueOnly(!overdueOnly)}
            >
              Overdue Only
            </Button>
            <Button type="primary" onClick={loadLedger}>Search</Button>
            <Button icon={<span className="anticon"><ReloadOutlined /></span>} onClick={loadLedger}>Refresh</Button>
            {customerInfo && (
              <Space size="large" style={{ marginLeft: 16 }}>
                <Avatar 
                  src={customerInfo.logo_path ? customerInfo.logo_path.replace('atom://', 'atom-file://') : undefined} 
                  shape="square" 
                  size="large"
                />
                <div>
                  {customerInfo.phone && <div style={{ fontSize: '12px', color: '#888' }}>📞 {customerInfo.phone}</div>}
                  {customerInfo.address && <div style={{ fontSize: '12px', color: '#888' }}>📍 {customerInfo.address}</div>}
                </div>
              </Space>
            )}
          </Space>
        </Card>

        {selectedCustomerId && !loading && ledger.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Invoices" value={invoiceCount} prefix={<FileTextOutlined />} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Payments" value={paymentCount} prefix={<DollarOutlined />} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Debited" value={totalDebit} valueStyle={{ color: '#cf1322' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Credited" value={totalCredit} valueStyle={{ color: '#389e0d' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small">
              <Statistic
                title="Closing Balance"
                value={closingBal}
                valueStyle={{ color: closingBal > 0 ? '#ff4d4f' : closingBal < 0 ? '#52c41a' : undefined }}
                formatter={(v) => Number(v).toLocaleString()}
                suffix={closingBal > 0 ? '(Receivable)' : closingBal < 0 ? '(Advance)' : '(Settled)'}
              />
            </Card></Col>
          </Row>
        )}
      </div>

      {/* Print header */}
      {ledger.length > 0 && (
        <div className="print-only" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 8 }}>
            <Avatar 
              src={customerInfo?.logo_path ? customerInfo.logo_path.replace('atom://', 'atom-file://') : undefined} 
              shape="square" 
              size={64}
              style={{ display: customerInfo?.logo_path ? 'block' : 'none' }}
            />
            <div style={{ textAlign: 'center' }}>
              <Title level={3} style={{ margin: 0 }}>{currentCompany?.name}</Title>
              <Title level={5} style={{ margin: 0, color: '#666' }}>Customer Ledger</Title>
            </div>
          </div>
          <Text style={{ display: 'block', textAlign: 'center' }}>Customer: <strong>{customerInfo?.name || 'All Customers'}</strong></Text>
          {customerInfo?.address && <Text style={{ display: 'block', textAlign: 'center', color: '#888', fontSize: '12px' }}>{customerInfo.address}</Text>}
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={[24, 8]} style={{ marginBottom: 12 }}>
            <Col span={5}><Text>Invoices: <strong>{invoiceCount}</strong></Text></Col>
            <Col span={5}><Text>Payments: <strong>{paymentCount}</strong></Text></Col>
            <Col span={5}><Text>Total Debited: <strong>{totalDebit.toLocaleString()}</strong></Text></Col>
            <Col span={5}><Text>Total Credited: <strong>{totalCredit.toLocaleString()}</strong></Text></Col>
            <Col span={4}><Text>Closing: <strong style={{ color: closingBal > 0 ? '#ff4d4f' : undefined }}>{closingBal.toLocaleString()}</strong></Text></Col>
          </Row>
        </div>
      )}

      {ledger.length === 0 && !loading ? (
        <Empty description="Select a customer or click Search to view all ledger data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          dataSource={ledger}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          bordered
          summary={summaryRow}
          rowClassName={(row) => row.type === 'payment' ? 'payment-row' : ''}
        />
      )}

      {/* Hidden print container for PDF capture */}
      <div id="print-container" style={{ display: 'none' }}>
          {ledger.length > 0 && (
              <ReportLedgerPdfDocument
                reportTitle="Customer Ledger"
                companyName={currentCompany?.name || '-'}
                dateFromLabel={dateFromLabel}
                dateToLabel={dateToLabel}
                entityLabel="Customer Name"
                entityName={customerInfo?.name || 'All Customers'}
                rows={pdfRows}
                totalDebit={totalDebit.toLocaleString()}
                totalCredit={totalCredit.toLocaleString()}
                closingBalance={closingBal.toLocaleString()}
                footerNote={`Generated on ${dayjs().format('DD-MMM-YYYY HH:mm')}`}
              />
          )}
      </div>

      <style>{`
        .payment-row { background: #f6ffed !important; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .app-sider, .app-header { display: none !important; }
          .app-layout { margin: 0 !important; }
          .app-content { padding: 0 !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </div>
  );
};

export default CustomerLedgerReport;
