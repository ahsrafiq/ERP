import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, DatePicker, Select, Button, Space,
  Statistic, Divider, Typography, message,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  PercentageOutlined, DollarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const TaxReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  useEffect(() => {
    if (currentCompany) { loadCustomers(); }
  }, [currentCompany]);

  useEffect(() => {
    if (currentCompany) { loadInvoices(); }
  }, [currentCompany, dateRange]);

  const loadCustomers = async () => {
    try {
      const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
      if (res.success) setCustomers(res.data || []);
    } catch { /* ignore */ }
  };

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate   = dateRange[1].format('YYYY-MM-DD');
      const res = await (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id, filters);
      if (res.success) setInvoices((res.data || []).filter((inv: any) => inv.status !== 'cancelled'));
      else message.error('Failed to load invoices');
    } catch { message.error('Failed to load invoices'); }
    finally { setLoading(false); }
  };

  const filtered = invoices.filter((inv) => {
    if (selectedCustomer && inv.customer_id !== selectedCustomer) return false;
    return true;
  });

  const totalSubtotal    = filtered.reduce((s, i) => s + (Number(i.subtotal)     || 0), 0);
  const totalTax         = filtered.reduce((s, i) => s + (Number(i.gst_total)    || 0), 0);
  const totalAmount      = filtered.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const effectiveTaxRate = totalSubtotal > 0 ? ((totalTax / totalSubtotal) * 100).toFixed(2) : '0.00';

  const columns = [
    { title: 'Sr.',         key: 'sr',            width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Invoice #',   dataIndex: 'invoice_number', key: 'invoice_number', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Date',        dataIndex: 'invoice_date',   key: 'date', render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '—' },
    { title: 'Customer',    dataIndex: 'customer_name',  key: 'customer', render: (v: string) => v || '—' },
    {
      title: 'Taxable Amount (Excl. Tax)',
      dataIndex: 'subtotal', key: 'subtotal', align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString(),
    },
    {
      title: 'Tax Rate',
      key: 'tax_rate', align: 'center' as const,
      render: (_: any, row: any) => {
        const sub = Number(row.subtotal) || 0;
        const tax = Number(row.gst_total) || 0;
        if (sub <= 0) return '—';
        return `${((tax / sub) * 100).toFixed(2)}%`;
      },
    },
    {
      title: 'Tax Amount',
      dataIndex: 'gst_total', key: 'gst_total', align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>{Number(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Total (Incl. Tax)',
      dataIndex: 'total_amount', key: 'total', align: 'right' as const,
      render: (v: number) => <Text strong>{Number(v || 0).toLocaleString()}</Text>,
    },
  ];

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>Total ({filtered.length} records)</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">{totalSubtotal.toLocaleString()}</Table.Summary.Cell>
        <Table.Summary.Cell index={2} align="center">{effectiveTaxRate}%</Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: '#cf1322' }}>{totalTax.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right"><Text strong>{totalAmount.toLocaleString()}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  const handleExportExcel = () => {
    const periodLabel  = `${dateRange[0]?.format('DDMMYYYY')}_${dateRange[1]?.format('DDMMYYYY')}`;
    const companyName  = currentCompany?.name || 'Company';
    const numCols      = 8;

    const thin  = { top: { style: 'thin', color: { rgb: 'AAAAAA' } }, bottom: { style: 'thin', color: { rgb: 'AAAAAA' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } };
    const thick = { ...thin, bottom: { style: 'medium', color: { rgb: '000000' } } };

    const sTitle  = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const sSub    = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
    const sMeta   = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
    const sHdr    = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F5496' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
    const sHdrR   = { ...sHdr, alignment: { horizontal: 'right', vertical: 'center' } };
    const sData   = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thin };
    const sDataR  = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDataC  = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
    const sTaxAmt = { font: { bold: true, sz: 10, color: { rgb: 'C00000' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDataBR = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sTot    = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thick };
    const sTotC   = { ...sTot, alignment: { horizontal: 'center', vertical: 'center' } };
    const sSumL   = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thin };
    const sSumV   = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };

    const c = (v: any, s: any) => ({ v, s });

    const colHdrs = [
      c('Sr.', sHdr), c('Invoice #', sHdr), c('Date', sHdr), c('Customer', sHdr),
      c('Taxable Amount (Excl. Tax)', sHdrR), c('Tax Rate', sHdrR),
      c('Tax Amount', sHdrR), c('Total (Incl. Tax)', sHdrR),
    ];

    const dataRows = filtered.map((inv, i) => {
      const sub = Number(inv.subtotal) || 0;
      const tax = Number(inv.gst_total) || 0;
      const rate = sub > 0 ? `${((tax / sub) * 100).toFixed(2)}%` : '—';
      return [
        c(i + 1, sData),
        c(inv.invoice_number || '', sData),
        c(inv.invoice_date ? dayjs(inv.invoice_date).format('DD-MM-YYYY') : '', sData),
        c(inv.customer_name || '', sData),
        c(sub, sDataR),
        c(rate, sDataC),
        c(tax, sTaxAmt),
        c(Number(inv.total_amount) || 0, sDataBR),
      ];
    });

    const totalsRow = [
      c('', sTot), c('TOTAL', sTot), c('', sTot), c(`${filtered.length} records`, sTot),
      c(totalSubtotal, sTot), c(`${effectiveTaxRate}%`, sTotC),
      c(totalTax, sTot), c(totalAmount, sTot),
    ];

    const summaryRows: any[][] = [
      [],
      [c('Summary', { font: { bold: true, sz: 11 } })],
      [c('Total Records',       sSumL), c(''), c(''), c(filtered.length,   sSumV)],
      [c('Total Taxable Amount',sSumL), c(''), c(''), c(totalSubtotal,     sSumV)],
      [c('Effective Tax Rate',  sSumL), c(''), c(''), c(`${effectiveTaxRate}%`, { ...sSumV, alignment: { horizontal: 'right' } })],
      [c('Total Tax Collected', sSumL), c(''), c(''), c(totalTax,          sSumV)],
      [c('Grand Total',         sSumL), c(''), c(''), c(totalAmount,       sSumV)],
    ];

    const wsData: any[][] = [
      [c(companyName, sTitle)],
      [c('Tax Deduction Report', sSub)],
      [c(`Period: ${dateRange[0]?.format('DD-MM-YYYY')} — ${dateRange[1]?.format('DD-MM-YYYY')}`, sMeta)],
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
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 13 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 15 }, { wch: 18 }];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Tax Report');
    XLSXStyle.writeFile(wb, `Tax_Report_${periodLabel}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Tax Deduction Report — {currentCompany?.name}</Title>
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>Export Excel</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
          </Space>
        </div>

        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <RangePicker value={dateRange} onChange={(d) => d && d[0] && d[1] && setDateRange([d[0], d[1]])} format="DD-MM-YYYY" />
            <Select allowClear placeholder="All Customers" style={{ width: 220 }} value={selectedCustomer} onChange={setSelectedCustomer}
              options={customers.map((c: any) => ({ label: c.name, value: c.id }))} showSearch optionFilterProp="label" />
            <Button onClick={loadInvoices}>Refresh</Button>
          </Space>
        </Card>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Records" value={filtered.length} prefix={<FileTextOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Taxable Amount" value={totalSubtotal} prefix={<DollarOutlined />} valueStyle={{ color: '#1890ff' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Effective Tax Rate" value={effectiveTaxRate} suffix="%" prefix={<PercentageOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Tax Collected" value={totalTax} valueStyle={{ color: '#cf1322' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Grand Total (Incl. Tax)" value={totalAmount} valueStyle={{ color: '#389e0d' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
        </Row>
      </div>

      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Tax Deduction Report</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>
          Period: {dateRange[0]?.format('DD-MM-YYYY')} — {dateRange[1]?.format('DD-MM-YYYY')}
        </Text>
        <Divider style={{ margin: '8px 0' }} />
        <Row gutter={[24, 8]} style={{ marginBottom: 12 }}>
          <Col span={4}><Text>Records: <strong>{filtered.length}</strong></Text></Col>
          <Col span={6}><Text>Taxable Amount: <strong>{totalSubtotal.toLocaleString()}</strong></Text></Col>
          <Col span={5}><Text>Effective Rate: <strong>{effectiveTaxRate}%</strong></Text></Col>
          <Col span={5}><Text>Tax Collected: <strong>{totalTax.toLocaleString()}</strong></Text></Col>
          <Col span={4}><Text>Grand Total: <strong>{totalAmount.toLocaleString()}</strong></Text></Col>
        </Row>
      </div>

      <Table dataSource={filtered} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" bordered summary={summaryRow} />

      <style>{`
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

export default TaxReport;
