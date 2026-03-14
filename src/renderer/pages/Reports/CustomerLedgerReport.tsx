import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Select, Button, Space,
  Statistic, Divider, Typography, notification, message, Empty, Tag,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  UserOutlined, DollarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { Title, Text } = Typography;

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

const CustomerLedgerReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentCompany) loadCustomers();
  }, [currentCompany]);

  useEffect(() => {
    if (selectedCustomerId) loadLedger(selectedCustomerId);
    else { setLedger([]); setCustomerInfo(null); }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    try {
      const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
      if (res.success) setCustomers(res.data || []);
    } catch { /* ignore */ }
  };

  const loadLedger = async (customerId: number) => {
    setLoading(true);
    try {
      const customer = customers.find((c) => c.id === customerId);
      setCustomerInfo(customer);

      // Load all sales invoices for this customer
      const invRes = await (window as any).electronAPI.db.salesInvoices.getAll(
        currentCompany!.id,
        {}
      );
      const invoices = ((invRes.success ? invRes.data : []) || []).filter(
        (inv: any) => inv.customer_id === customerId
      );

      // Load all payments for this customer
      const payRes = await (window as any).electronAPI.db.payments.getAll(
        currentCompany!.id,
        { type: 'in' }
      );
      const payments = ((payRes.success ? payRes.data : []) || []).filter(
        (p: any) => p.customer_id === customerId
      );

      // Combine into unified ledger entries
      const entries: Omit<LedgerEntry, 'balance'>[] = [
        ...invoices.map((inv: any) => ({
          id: `inv-${inv.id}`,
          date: inv.invoice_date,
          type: 'invoice' as const,
          reference: inv.invoice_number,
          description: `Sales Invoice`,
          debit: Number(inv.total_amount) || 0,
          credit: 0,
        })),
        ...payments.map((p: any) => ({
          id: `pay-${p.id}`,
          date: p.payment_date,
          type: 'payment' as const,
          reference: p.payment_number,
          description: `Payment Received${p.payment_method ? ` (${p.payment_method})` : ''}${p.notes ? ' — ' + p.notes : ''}`,
          debit: 0,
          credit: Number(p.amount) || 0,
        })),
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
        runningBalance += entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      });

      setLedger(ledgerRows);
    } catch (err) {
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
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (t: string) => t === 'invoice'
        ? <Tag color="blue">Invoice</Tag>
        : <Tag color="green">Payment</Tag>,
    },
    { title: 'Reference', dataIndex: 'reference',   key: 'reference', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Debit (Invoice)',
      dataIndex: 'debit', key: 'debit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credit (Payment)',
      dataIndex: 'credit', key: 'credit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Balance',
      dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => (
        <Text strong type={v > 0 ? 'danger' : v < 0 ? 'success' : undefined}>
          {Number(v).toLocaleString()}
        </Text>
      ),
    },
  ];

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={5} align="right"><Text strong>Total</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right"><Text style={{ color: '#cf1322' }} strong>{totalDebit.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={2} align="right"><Text style={{ color: '#389e0d' }} strong>{totalCredit.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right"><Text strong type={closingBal > 0 ? 'danger' : closingBal < 0 ? 'success' : undefined}>{closingBal.toLocaleString()}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  const handleExportExcel = () => {
    if (!customerInfo) return;
    const companyName = currentCompany?.name || 'Company';
    const custName    = customerInfo.name || 'Customer';
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
    const numCols = 8;

    const colHdrs = [
      c('Sr.', sHdr), c('Date', sHdr), c('Type', sHdr), c('Reference', sHdr),
      c('Description', sHdr), c('Debit (Invoice)', sHdrR), c('Credit (Payment)', sHdrR), c('Balance', sHdrR),
    ];

    const dataRows = ledger.map((row, i) => [
      c(i + 1,                                     sData),
      c(row.date ? dayjs(row.date).format('DD-MM-YYYY') : '', sData),
      c(row.type === 'invoice' ? 'Invoice' : 'Payment', sData),
      c(row.reference,                             sData),
      c(row.description,                           sData),
      c(row.debit  > 0 ? row.debit  : '',          row.debit  > 0 ? sDebit : sDataR),
      c(row.credit > 0 ? row.credit : '',          row.credit > 0 ? sCred  : sDataR),
      c(row.balance,                               sBal),
    ]);

    const totalsRow = [
      c('', sTot), c('', sTot), c('', sTot), c('', sTot), c('TOTAL', sTot),
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
    ws['!cols'] = [
      { wch: 25 }, { wch: 13 }, { wch: 10 }, { wch: 16 },
      { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    ];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Customer Ledger');
    XLSXStyle.writeFile(wb, `Customer_Ledger_${custName.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

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
              disabled={!selectedCustomerId}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} disabled={!selectedCustomerId} onClick={() => window.print()}>
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
            {customerInfo && (
              <Space size="large" style={{ marginLeft: 16 }}>
                {customerInfo.phone && <Text type="secondary">📞 {customerInfo.phone}</Text>}
                {customerInfo.address && <Text type="secondary">📍 {customerInfo.address}</Text>}
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
      {selectedCustomerId && (
        <div className="print-only" style={{ marginBottom: 16 }}>
          <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
          <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Customer Ledger</Title>
          <Text style={{ display: 'block', textAlign: 'center' }}>Customer: <strong>{customerInfo?.name}</strong></Text>
          {customerInfo?.address && <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>{customerInfo.address}</Text>}
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

      {!selectedCustomerId ? (
        <Empty description="Select a customer above to view their ledger" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
