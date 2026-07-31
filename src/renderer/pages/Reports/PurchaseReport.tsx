import React, { useState, useEffect } from 'react';
import { useCompanyDataLoader } from '../../hooks/useCompanyDataLoader';
import { Table, Card, Row, Col, DatePicker, Select, Button, Space, Tag, Statistic, Divider, Typography, notification, message, Input } from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileTextOutlined,
  DollarOutlined, FileExcelOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  paid: 'green', partial: 'orange', unpaid: 'red', draft: 'default', cancelled: 'volcano',
};

const PurchaseReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<any[]>([]);
  const { data: vendors, loading: vendorsLoading, setData: setVendors } = useCompanyDataLoader<any>((companyId) => (window as any).electronAPI.db.vendors.getAll(companyId), [{ selected: selectedVendor, setSelected: setSelectedVendor, idField: 'id' }]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');


  // Keep existing loading flag for invoices; combine with vendorsLoading if needed
  useEffect(() => {
    setLoading(vendorsLoading);
  }, [vendorsLoading]);

  // REMOVED AUTO-LOAD ON dateRange CHANGE
  // useEffect(() => {
  //   if (currentCompany) { loadInvoices(); }
  // }, [currentCompany, dateRange]);



  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate   = dateRange[1].format('YYYY-MM-DD');
      if (itemName) filters.itemName = itemName;
      if (brand) filters.brand = brand;
      if (quantity) filters.quantity = quantity;
      if (unitPrice) filters.unitPrice = unitPrice;
      const res = await (window as any).electronAPI.db.purchaseInvoices.getAll(currentCompany.id, filters);
      if (res.success) setInvoices(res.data || []);
      else notification.error({ message: 'Error', description: 'Failed to load purchase invoices', duration: 0 });
    } catch { notification.error({ message: 'Error', description: 'Failed to load purchase invoices', duration: 0 }); }
    finally { setLoading(false); }
  };

  const filtered = invoices.filter((inv) => {
    if (selectedVendor && inv.vendor_id !== selectedVendor) return false;
    if (selectedStatus && inv.status !== selectedStatus) return false;
    return true;
  });

  const totalInvoices     = filtered.length;
  const totalSubtotal     = filtered.reduce((s, i) => s + (Number(i.subtotal)      || 0), 0);
  const totalTax          = filtered.reduce((s, i) => s + (Number(i.gst_total)     || 0), 0);
  const totalAmount       = filtered.reduce((s, i) => s + (Number(i.total_amount)  || 0), 0);
  const totalBalance      = filtered.reduce((s, i) => s + (Number(i.balance)       || 0), 0);
  const totalPaid         = totalAmount - totalBalance;
  const isGst             = !!currentCompany?.is_gst_enabled;

  const columns = [
    { title: 'Sr.',         key: 'sr',             width: 50,  render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Invoice #',   dataIndex: 'invoice_number', key: 'invoice_number', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Date',        dataIndex: 'invoice_date',   key: 'date',           render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '—' },
    { title: 'Vendor',      dataIndex: 'vendor_name',    key: 'vendor',         render: (v: string) => v || '—' },
    { title: 'Subtotal',    dataIndex: 'subtotal',       key: 'subtotal',       align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    ...(isGst ? [{
      title: 'Tax', dataIndex: 'gst_total', key: 'gst_total', align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString(),
    }] : []),
    { title: 'Total Amount', dataIndex: 'total_amount', key: 'total', align: 'right' as const, render: (v: number) => <Text strong>{Number(v || 0).toLocaleString()}</Text> },
    { title: 'Paid', key: 'paid', align: 'right' as const, render: (_: any, row: any) => ((Number(row.total_amount) || 0) - (Number(row.balance) || 0)).toLocaleString() },
    {
      title: 'Balance Due', dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => { const b = Number(v || 0); return <Text type={b > 0 ? 'danger' : undefined}>{b.toLocaleString()}</Text>; },
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v] || 'default'}>{(v || '').toUpperCase()}</Tag> },
  ];

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>Total ({totalInvoices} records)</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">{totalSubtotal.toLocaleString()}</Table.Summary.Cell>
        {isGst && <Table.Summary.Cell index={2} align="right">{totalTax.toLocaleString()}</Table.Summary.Cell>}
        <Table.Summary.Cell index={isGst ? 3 : 2} align="right"><Text strong>{totalAmount.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 4 : 3} align="right">{totalPaid.toLocaleString()}</Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 5 : 4} align="right"><Text type={totalBalance > 0 ? 'danger' : undefined} strong>{totalBalance.toLocaleString()}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 6 : 5} />
      </Table.Summary.Row>
    </Table.Summary>
  );

  const handleSavePDF = async () => {
    try {
      const fileName = `Purchase_Report_${dayjs().format('YYYY-MM-DD')}.pdf`;
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

  const handleExportExcel = () => {
    const periodLabel   = `${dateRange[0]?.format('DDMMYYYY')}_${dateRange[1]?.format('DDMMYYYY')}`;
    const companyName   = currentCompany?.name || 'Company';
    const numCols       = isGst ? 10 : 9;

    const thin   = { top: { style: 'thin', color: { rgb: 'AAAAAA' } }, bottom: { style: 'thin', color: { rgb: 'AAAAAA' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } };
    const thick  = { ...thin, bottom: { style: 'medium', color: { rgb: '000000' } } };

    const sTitle    = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const sSub      = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
    const sMeta     = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
    const sHdr      = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F5496' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
    const sHdrR     = { ...sHdr, alignment: { horizontal: 'right', vertical: 'center' } };
    const sData     = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thin };
    const sDataR    = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDataBR   = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sDataRed  = { font: { bold: true, sz: 10, color: { rgb: 'C00000' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
    const sTot      = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thick };
    const sSumL     = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thin };
    const sSumV     = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };

    const c = (v: any, s: any = {}) => ({ v, s });

    const colHdrs = [
      c('Sr.', sHdr), c('Invoice #', sHdr), c('Date', sHdr), c('Vendor', sHdr),
      c('Subtotal', sHdrR), ...(isGst ? [c('Tax', sHdrR)] : []),
      c('Total Amount', sHdrR), c('Paid', sHdrR), c('Balance Due', sHdrR), c('Status', sHdr),
    ];

    const dataRows = filtered.map((inv, i) => {
      const paid = (Number(inv.total_amount) || 0) - (Number(inv.balance) || 0);
      const bal  = Number(inv.balance) || 0;
      return [
        c(i + 1, sData),
        c(inv.invoice_number || '', sData),
        c(inv.invoice_date ? dayjs(inv.invoice_date).format('DD-MM-YYYY') : '', sData),
        c(inv.vendor_name || '', sData),
        c(Number(inv.subtotal) || 0, sDataR),
        ...(isGst ? [c(Number(inv.gst_total) || 0, sDataR)] : []),
        c(Number(inv.total_amount) || 0, sDataBR),
        c(paid, sDataR),
        c(bal, bal > 0 ? sDataRed : sDataR),
        c((inv.status || '').toUpperCase(), sData),
      ];
    });

    const totalsRow = [
      c('', sTot), c('TOTAL', sTot), c('', sTot), c(`${totalInvoices} records`, sTot),
      c(totalSubtotal, sTot), ...(isGst ? [c(totalTax, sTot)] : []),
      c(totalAmount, sTot), c(totalPaid, sTot), c(totalBalance, sTot), c('', sTot),
    ];

    const summaryRows = [
      [],
      [c('Summary', { font: { bold: true, sz: 11 } })],
      [c('Total Records',        sSumL), c(''), c(''), c(totalInvoices,  sSumV)],
      [c('Total Subtotal',       sSumL), c(''), c(''), c(totalSubtotal,  sSumV)],
      ...(isGst ? [[c('Total Tax', sSumL), c(''), c(''), c(totalTax, sSumV)]] : []),
      [c('Grand Total',          sSumL), c(''), c(''), c(totalAmount,    sSumV)],
      [c('Total Paid',           sSumL), c(''), c(''), c(totalPaid,      sSumV)],
      [c('Total Balance Due',    sSumL), c(''), c(''), c(totalBalance,   sSumV)],
    ];

    const wsData: any[][] = [
      [c(companyName, sTitle)],
      [c('Purchase Report', sSub)],
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
    ws['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 13 }, { wch: 28 }, { wch: 14 },
      ...(isGst ? [{ wch: 12 }] : []),
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Purchase Report');
    XLSXStyle.writeFile(wb, `Purchase_Report_${periodLabel}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Purchase Report — {currentCompany?.name}</Title>
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>Export Excel</Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
            <Button type="primary" onClick={handleSavePDF}>Save as PDF</Button>
          </Space>
        </div>

        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <RangePicker value={dateRange} onChange={(d) => d && d[0] && d[1] && setDateRange([d[0], d[1]])} format="DD-MM-YYYY" />
            <Select allowClear placeholder="All Vendors" style={{ width: 200 }} value={selectedVendor} onChange={setSelectedVendor}
              options={vendors.map((v: any) => ({ label: v.name, value: v.id }))} showSearch optionFilterProp="label" />
            <Select allowClear placeholder="All Statuses" style={{ width: 130 }} value={selectedStatus} onChange={setSelectedStatus}
              options={[
                { label: 'Draft', value: 'draft' }, { label: 'Unpaid', value: 'unpaid' },
                { label: 'Partial', value: 'partial' }, { label: 'Paid', value: 'paid' },
                { label: 'Cancelled', value: 'cancelled' },
              ]} />
            <Input
              placeholder="Item Name"
              style={{ width: 120 }}
              value={itemName}
              onChange={(e: any) => setItemName(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Brand"
              style={{ width: 100 }}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Qty"
              style={{ width: 70 }}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Price"
              style={{ width: 80 }}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              allowClear
            />
            <Button type="primary" onClick={loadInvoices}>Search</Button>
          </Space>
        </Card>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Total Records" value={totalInvoices} prefix={<FileTextOutlined />} /></Card></Col>
          <Col xs={12} sm={8} md={5}><Card size="small"><Statistic title="Subtotal" value={totalSubtotal} prefix={<ShoppingOutlined />} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          {isGst && <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Total Tax" value={totalTax} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>}
          <Col xs={12} sm={8} md={5}><Card size="small"><Statistic title="Total Amount" value={totalAmount} prefix={<DollarOutlined />} valueStyle={{ color: '#1890ff' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={5}><Card size="small"><Statistic title="Total Paid" value={totalPaid} valueStyle={{ color: '#52c41a' }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
          <Col xs={12} sm={8} md={5}><Card size="small"><Statistic title="Balance Due" value={totalBalance} valueStyle={{ color: totalBalance > 0 ? '#ff4d4f' : undefined }} formatter={(v) => Number(v).toLocaleString()} /></Card></Col>
        </Row>
      </div>

      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Purchase Report</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>
          Period: {dateRange[0]?.format('DD-MM-YYYY')} — {dateRange[1]?.format('DD-MM-YYYY')}
        </Text>
        <Divider style={{ margin: '8px 0' }} />
        <Row gutter={[24, 8]} style={{ marginBottom: 12 }}>
          <Col span={4}><Text>Records: <strong>{totalInvoices}</strong></Text></Col>
          <Col span={5}><Text>Subtotal: <strong>{totalSubtotal.toLocaleString()}</strong></Text></Col>
          {isGst && <Col span={4}><Text>Tax: <strong>{totalTax.toLocaleString()}</strong></Text></Col>}
          <Col span={5}><Text>Total: <strong>{totalAmount.toLocaleString()}</strong></Text></Col>
          <Col span={5}><Text>Balance: <strong>{totalBalance.toLocaleString()}</strong></Text></Col>
        </Row>
      </div>

      <Table dataSource={filtered} columns={columns} rowKey="id" loading={loading || vendorsLoading} pagination={false} size="small" bordered summary={summaryRow} />

      {/* PDF Capture container */}
      <div id="report-pdf-container" style={{ display: 'none' }}>
        <ReportTablePdfDocument
          reportTitle="Purchase Report"
          companyName={currentCompany?.name || '-'}
          periodLabel={`Period: ${dateRange[0]?.format('DD-MM-YYYY')} — ${dateRange[1]?.format('DD-MM-YYYY')}`}
          columns={[
            { title: 'Date', dataIndex: 'invoice_date', align: 'center' as const, render: (v) => dayjs(v).format('DD-MM-YYYY') },
            { title: 'Invoice #', dataIndex: 'invoice_number', align: 'left' as const },
            { title: 'Vendor', dataIndex: 'vendor_name', align: 'left' as const },
            { title: 'Subtotal', dataIndex: 'subtotal', align: 'right' as const, render: (v) => Number(v || 0).toLocaleString() },
            ...(isGst ? [{ title: 'Tax', dataIndex: 'gst_total', align: 'right' as const, render: (v: any) => Number(v || 0).toLocaleString() }] : []),
            { title: 'Total', dataIndex: 'total_amount', align: 'right' as const, render: (v) => Number(v || 0).toLocaleString() },
            { title: 'Paid', dataIndex: 'id', align: 'right' as const, render: (_, r) => ((Number(r.total_amount) || 0) - (Number(r.balance) || 0)).toLocaleString() },
            { title: 'Balance', dataIndex: 'balance', align: 'right' as const, render: (v) => Number(v || 0).toLocaleString() },
          ]}
          data={filtered}
          summaryRow={
            <tr className="erp-report-pdf-total-row">
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalSubtotal.toLocaleString()}</td>
              {isGst && <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalTax.toLocaleString()}</td>}
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalAmount.toLocaleString()}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalPaid.toLocaleString()}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalBalance.toLocaleString()}</td>
            </tr>
          }
          footerNote={`Generated on ${dayjs().format('DD-MMM-YYYY HH:mm')}`}
        />
      </div>

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

export default PurchaseReport;
