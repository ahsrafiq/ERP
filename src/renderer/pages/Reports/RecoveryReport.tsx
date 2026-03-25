import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Button, Space, DatePicker,
  Statistic, Divider, Typography, notification, message, Tag, Progress,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  TeamOutlined, DollarOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { Title, Text } = Typography;

interface CustomerRecovery {
  id: number;
  code: string;
  name: string;
  phone: string;
  po_number: string;
  totalInvoiced: number;
  totalPaid: number;      // Total settled (including tax)
  taxDeducted: number;    // Total tax withheld
  netReceived: number;    // Actual cash/bank received
  balance: number;
  current: number;       // not yet overdue
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90plus: number;
  lastInvoiceDate: string;
  invoiceCount: number;
}

const agingBucket = (invoiceDate: string, dueDate: string | null, balance: number) => {
  if (balance <= 0) return { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 };
  const refDate = dueDate || invoiceDate;
  const days = dayjs().diff(dayjs(refDate), 'day');
  if (days <= 0)  return { current: balance, days1_30: 0,       days31_60: 0,       days61_90: 0,       days90plus: 0 };
  if (days <= 30) return { current: 0,       days1_30: balance, days31_60: 0,       days61_90: 0,       days90plus: 0 } as any;
  if (days <= 60) return { current: 0,       days1_30: 0,       days31_60: balance, days61_90: 0,       days90plus: 0 };
  if (days <= 90) return { current: 0,       days1_30: 0,       days31_60: 0,       days61_90: balance, days90plus: 0 };
  return               { current: 0,       days1_30: 0,       days31_60: 0,       days61_90: 0,       days90plus: balance };
};

const RecoveryReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [recoveryData, setRecoveryData] = useState<CustomerRecovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  useEffect(() => {
    // loadData(); // Removed auto-load
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        filters.fromDate = dateRange[0].format('YYYY-MM-DD');
        filters.toDate = dateRange[1].format('YYYY-MM-DD');
      }

      const [custRes, invRes, payRes] = await Promise.all([
        (window as any).electronAPI.db.customers.getAll(currentCompany.id),
        (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id, filters),
        (window as any).electronAPI.db.payments.getAll(currentCompany.id, { type: 'in' }),
      ]);

      const customers = custRes.success ? (custRes.data || []) : [];
      const invoices  = invRes.success  ? (invRes.data  || []) : [];
      const payments  = payRes.success  ? (payRes.data  || []) : [];

      const map: Record<number, CustomerRecovery> = {};

      customers.forEach((c: any) => {
        map[c.id] = {
          id: c.id, code: c.code || '', name: c.name || '', phone: c.phone || '',
          po_number: c.po_number || '',
          totalInvoiced: 0, totalPaid: 0, taxDeducted: 0, netReceived: 0, balance: 0,
          current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0,
          lastInvoiceDate: '', invoiceCount: 0,
        };
      });

      invoices.forEach((inv: any) => {
        const cid = inv.customer_id;
        if (!map[cid]) return;
        const r   = map[cid];
        const bal = Number(inv.balance) || 0;
        const tot = Number(inv.total_amount) || 0;

        r.totalInvoiced += tot;
        r.balance       += bal;
        r.totalPaid     += tot - bal;
        r.invoiceCount  += 1;
        if (!r.lastInvoiceDate || inv.invoice_date > r.lastInvoiceDate) r.lastInvoiceDate = inv.invoice_date;

        if (bal > 0) {
          const b = agingBucket(inv.invoice_date, inv.due_date, bal);
          r.current   += b.current   || 0;
          r.days1_30  += b.days1_30  || 0;
          r.days31_60 += b.days31_60 || 0;
          r.days61_90 += b.days61_90 || 0;
          r.days90plus += b.days90plus || 0;
        }
      });

      // Aggregate payments for tax/net received
      payments.forEach((p: any) => {
        const cid = p.customer_id;
        if (!map[cid]) return;
        const r = map[cid];
        
        // Apply date filters to payments too if active
        if (dateRange && dateRange[0] && dateRange[1]) {
           const pDate = p.payment_date;
           const from = dateRange[0].format('YYYY-MM-DD');
           const to = dateRange[1].format('YYYY-MM-DD');
           if (pDate < from || pDate > to) return;
        }

        r.netReceived += Number(p.amount) || 0;
        r.taxDeducted += Number(p.tax_deduction) || 0;
      });

      setRecoveryData(Object.values(map).sort((a, b) => b.balance - a.balance));
    } catch (err) { 
      console.error(err);
      notification.error({ message: 'Error', description: 'Failed to load recovery data', duration: 0 }); 
    }
    finally { setLoading(false); }
  };

  // Show only customers who currently own money (no settled customers).
  const displayed = recoveryData.filter((r) => r.balance > 0);

  const totalInvoiced    = displayed.reduce((s, r) => s + r.totalInvoiced, 0);
  const totalTaxDeducted = displayed.reduce((s, r) => s + r.taxDeducted,    0);
  const totalNetReceived = displayed.reduce((s, r) => s + r.netReceived,    0);
  const totalPaid        = displayed.reduce((s, r) => s + r.totalPaid,      0);
  const totalBalance     = displayed.reduce((s, r) => s + r.balance,        0);
  const totalCurrent     = displayed.reduce((s, r) => s + r.current,        0);
  const total1_30        = displayed.reduce((s, r) => s + r.days1_30,       0);
  const total31_60       = displayed.reduce((s, r) => s + r.days31_60,      0);
  const total61_90       = displayed.reduce((s, r) => s + r.days61_90,      0);
  const total90plus      = displayed.reduce((s, r) => s + r.days90plus,     0);
  const withBalance      = displayed.filter((r) => r.balance > 0).length;

  const columns = [
    { title: 'Sr.', key: 'sr', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 80 },
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number', width: 130 },
    {
      title: 'Customer', dataIndex: 'name', key: 'name',
      render: (v: string, row: any) => (
        <div>
          <Text strong>{v}</Text>
          {row.phone && <div style={{ fontSize: 11, color: '#888' }}>{row.phone}</div>}
        </div>
      ),
    },
    { title: 'Invoices', dataIndex: 'invoiceCount', key: 'invoiceCount', align: 'center' as const },
    {
      title: 'Last Invoice',
      dataIndex: 'lastInvoiceDate', key: 'lastInvoiceDate',
      render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '—',
    },
    { title: 'Total Invoiced', dataIndex: 'totalInvoiced', key: 'totalInvoiced', align: 'right' as const, render: (v: number) => Number(v).toLocaleString() },
    { title: 'Tax Deducted', dataIndex: 'taxDeducted', key: 'taxDeducted', align: 'right' as const, render: (v: number) => <Text style={{ color: '#fa8c16' }}>{Number(v).toLocaleString()}</Text> },
    { title: 'Net Received', dataIndex: 'netReceived', key: 'netReceived', align: 'right' as const, render: (v: number) => <Text style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</Text> },
    {
      title: 'Outstanding', dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</Text>,
    },
    { title: 'Current',     dataIndex: 'current',   key: 'current',   align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="blue">{Number(v).toLocaleString()}</Tag>   : '—' },
    { title: '1–30 Days',   dataIndex: 'days1_30',  key: 'days1_30',  align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="orange">{Number(v).toLocaleString()}</Tag>  : '—' },
    { title: '31–60 Days',  dataIndex: 'days31_60', key: 'days31_60', align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="volcano">{Number(v).toLocaleString()}</Tag> : '—' },
    { title: '61–90 Days',  dataIndex: 'days61_90', key: 'days61_90', align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="red">{Number(v).toLocaleString()}</Tag>     : '—' },
    { title: '90+ Days',    dataIndex: 'days90plus',key: 'days90plus',align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="magenta" style={{ fontWeight: 700 }}>{Number(v).toLocaleString()}</Tag> : '—' },
  ];

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>Total ({displayed.length} customers)</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={6} align="right">{totalInvoiced.toLocaleString()}</Table.Summary.Cell>
        <Table.Summary.Cell index={7} align="right"><Text style={{ color: '#fa8c16' }} strong>{totalTaxDeducted.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={8} align="right"><Text style={{ color: '#389e0d' }} strong>{totalNetReceived.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={9} align="right"><Text strong style={{ color: '#cf1322' }}>{totalBalance.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={10} align="right">{totalCurrent > 0 ? totalCurrent.toLocaleString() : '—'}</Table.Summary.Cell>
        <Table.Summary.Cell index={11} align="right">{total1_30   > 0 ? total1_30.toLocaleString()   : '—'}</Table.Summary.Cell>
        <Table.Summary.Cell index={12} align="right">{total31_60  > 0 ? total31_60.toLocaleString()  : '—'}</Table.Summary.Cell>
        <Table.Summary.Cell index={13} align="right">{total61_90  > 0 ? total61_90.toLocaleString()  : '—'}</Table.Summary.Cell>
        <Table.Summary.Cell index={14} align="right">{total90plus > 0 ? total90plus.toLocaleString() : '—'}</Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  const handleExportExcel = () => {
    const companyName = currentCompany?.name || 'Company';
    const dateStr     = new Date().toLocaleDateString('en-GB');
    // Used for Excel merge ranges (last column index = numCols + 1).
    const numCols     = 14;

    const thin  = { top: { style: 'thin', color: { rgb: 'AAAAAA' } }, bottom: { style: 'thin', color: { rgb: 'AAAAAA' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } };
    const thick = { ...thin, bottom: { style: 'medium', color: { rgb: '000000' } } };

    const sTitle = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const sSub   = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
    const sMeta  = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
    const sHdr   = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F5496' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
    const sHdrR  = { ...sHdr, alignment: { horizontal: 'right', vertical: 'center' } };
    const sData  = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thin };
    const sDataR = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sGreen = { font: { sz: 10, color: { rgb: '375623' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sRed   = { font: { bold: true, sz: 10, color: { rgb: 'C00000' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sOrange= { font: { sz: 10, color: { rgb: 'C55A11' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDkRed = { font: { bold: true, sz: 10, color: { rgb: '833C00' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sTot   = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thick };
    const sSumL  = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thin };
    const sSumV  = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };

    const c = (v: any, s: any = {}) => ({ v, s });

    const colHdrs = [
      c('Sr.', sHdr),
      c('Code', sHdr),
      c('PO Number', sHdr),
      c('Customer', sHdr),
      c('Phone', sHdr),
      c('Invoices', sHdrR),
      c('Last Invoice', sHdr),
      c('Total Invoiced', sHdrR),
      c('Tax Deducted', sHdrR),
      c('Net Received', sHdrR),
      c('Outstanding', sHdrR),
      c('Current', sHdrR),
      c('1–30 Days', sHdrR),
      c('31–60 Days', sHdrR),
      c('61–90 Days', sHdrR),
      c('90+ Days', sHdrR),
    ];

    const dataRows = displayed.map((row, i) => [
      c(i + 1, sData),
      c(row.code, sData),
      c(row.po_number || '', sData),
      c(row.name, sData),
      c(row.phone || '', sData),
      c(row.invoiceCount, sDataR),
      c(row.lastInvoiceDate ? dayjs(row.lastInvoiceDate).format('DD-MM-YYYY') : '', sData),
      c(row.totalInvoiced, sDataR),
      c(row.taxDeducted,   sOrange),
      c(row.netReceived,   sGreen),
      c(row.balance > 0 ? row.balance : 0, row.balance > 0 ? sRed : sDataR),
      c(row.current   > 0 ? row.current   : '', sDataR),
      c(row.days1_30  > 0 ? row.days1_30  : '', sOrange),
      c(row.days31_60 > 0 ? row.days31_60 : '', sOrange),
      c(row.days61_90 > 0 ? row.days61_90 : '', sRed),
      c(row.days90plus > 0 ? row.days90plus : '', sDkRed),
    ]);

    const totalsRow = [
      c('', sTot), c('', sTot), c('', sTot), c('TOTAL', sTot), c('', sTot),
      c(`${displayed.length}`, sTot), c('', sTot),
      c(totalInvoiced, sTot),
      c(totalTaxDeducted, sTot),
      c(totalNetReceived, sTot),
      c(totalBalance, sTot),
      c(totalCurrent, sTot),
      c(total1_30, sTot),
      c(total31_60, sTot),
      c(total61_90, sTot),
      c(total90plus, sTot),
    ];

    const summaryRows: any[][] = [
      [],
      [c('Summary', { font: { bold: true, sz: 11 } })],
      [c('Total Customers',      sSumL), c(''), c(''), c(displayed.length,  sSumV)],
      [c('Customers with Balance', sSumL), c(''), c(''), c(withBalance,     sSumV)],
      [c('Total Invoiced',       sSumL), c(''), c(''), c(totalInvoiced,     sSumV)],
      [c('Total Tax Deducted',   sSumL), c(''), c(''), c(totalTaxDeducted,   sSumV)],
      [c('Total Net Received',   sSumL), c(''), c(''), c(totalNetReceived,   sSumV)],
      [c('Total Outstanding',    sSumL), c(''), c(''), c(totalBalance,      sSumV)],
      [c('Current (Not Due)',    sSumL), c(''), c(''), c(totalCurrent,      sSumV)],
      [c('1–30 Days Overdue',   sSumL), c(''), c(''), c(total1_30,         sSumV)],
      [c('31–60 Days Overdue',  sSumL), c(''), c(''), c(total31_60,        sSumV)],
      [c('61–90 Days Overdue',  sSumL), c(''), c(''), c(total61_90,        sSumV)],
      [c('90+ Days Overdue',    sSumL), c(''), c(''), c(total90plus,       sSumV)],
    ];

    const wsData: any[][] = [
      [c(companyName, sTitle)],
      [c('Recovery Report (Accounts Receivable)', sSub)],
      [c(`Generated: ${dateStr}  |  Outstanding only`, sMeta)],
      [],
      colHdrs,
      ...dataRows,
      totalsRow,
      ...summaryRows,
    ];

    const ws: any = XLSXStyle.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols + 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols + 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols + 1 } },
    ];
    ws['!cols'] = [
      { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 9 }, { wch: 13 },
      { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
    ];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Recovery Report');
    XLSXStyle.writeFile(wb, `Recovery_Report_${dateStr.replace(/\//g, '-')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Recovery Report — {currentCompany?.name}</Title>
          </Space>
          <Space>
            <DatePicker.RangePicker
              picker="month"
              value={dateRange}
              onChange={(dates: any) => setDateRange(dates)}
              format="MMM-YYYY"
            />
            <Button type="primary" onClick={loadData}>Search</Button>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>Export Excel</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
          </Space>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Customers with Balance" value={withBalance} prefix={<TeamOutlined />} valueStyle={{ color: withBalance > 0 ? '#ff4d4f' : undefined }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Total Outstanding" value={totalBalance} prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Current (Not Due)" value={totalCurrent} valueStyle={{ color: '#1890ff' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="1–30 Days" value={total1_30} valueStyle={{ color: '#fa8c16' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="31–90 Days" value={total31_60 + total61_90} valueStyle={{ color: '#f5222d' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="90+ Days" value={total90plus} valueStyle={{ color: '#820014' }} formatter={(v) => Number(v).toLocaleString()} suffix={<WarningOutlined />} /></Card></Col>
        </Row>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Space align="center" style={{ width: '100%' }}>
            <Text strong>Collection Rate:</Text>
            <Progress
              percent={collectionRate}
              strokeColor={collectionRate >= 80 ? '#52c41a' : collectionRate >= 50 ? '#fa8c16' : '#ff4d4f'}
              style={{ width: 300 }}
            />
            <Text>Total Invoiced: <strong>{totalInvoiced.toLocaleString()}</strong></Text>
            <Text>Tax Deducted: <strong style={{ color: '#fa8c16' }}>{totalTaxDeducted.toLocaleString()}</strong></Text>
            <Text>Net Received: <strong style={{ color: '#389e0d' }}>{totalNetReceived.toLocaleString()}</strong></Text>
            <Text>Outstanding: <strong style={{ color: '#cf1322' }}>{totalBalance.toLocaleString()}</strong></Text>
          </Space>
        </Card>
      </div>

      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Recovery Report (Accounts Receivable)</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>Generated: {new Date().toLocaleDateString('en-GB')}</Text>
        <Divider style={{ margin: '8px 0' }} />
        <Row gutter={[24, 8]} style={{ marginBottom: 12 }}>
          <Col span={4}><Text>Customers: <strong>{withBalance}</strong></Text></Col>
          <Col span={5}><Text>Invoices: <strong>{totalInvoiced.toLocaleString()}</strong></Text></Col>
          <Col span={5}><Text>Tax Deducted: <strong>{totalTaxDeducted.toLocaleString()}</strong></Text></Col>
          <Col span={5}><Text>Net Received: <strong>{totalNetReceived.toLocaleString()}</strong></Text></Col>
          <Col span={5}><Text>Outstanding: <strong style={{ color: '#cf1322' }}>{totalBalance.toLocaleString()}</strong></Text></Col>
        </Row>
      </div>

      <Table
        dataSource={displayed}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        summary={summaryRow}
        rowClassName={(row) => row.balance <= 0 ? 'settled-row' : row.days90plus > 0 ? 'critical-row' : ''}
      />

      <style>{`
        .settled-row { background: #f6ffed !important; opacity: 0.7; }
        .critical-row td { background: #fff1f0 !important; }
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

export default RecoveryReport;
