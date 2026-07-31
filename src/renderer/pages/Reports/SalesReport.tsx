import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Table, Card, Row, Col, DatePicker, Select, Button, Space,
  Tag, Statistic, Divider, Typography, notification, message, Input,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileTextOutlined,
  DollarOutlined, TeamOutlined, BarChartOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  paid: 'green',
  partial: 'orange',
  unpaid: 'red',
  draft: 'default',
  cancelled: 'volcano',
};

const SalesReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);


    const salesPersonOptions = useMemo(() => {
      const filteredInvoices = selectedCustomer ? invoices.filter((inv: any) => Number(inv.customer_id) === Number(selectedCustomer)) : invoices;
      const names = Array.from(new Set(filteredInvoices.map((inv: any) => inv.customer_salesperson_name).filter(Boolean)));
      return names.map(name => ({ label: name, value: name }));
    }, [invoices, selectedCustomer]);

    useEffect(() => {
      if (currentCompany) {
        const prevCustomer = selectedCustomer;
      setLoading(true);
      setSelectedCustomer(null);
      setSelectedStatus(null);
      setCustomers([]);
      setInvoices([]);
      (async () => {
        try {
          const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
          if (res.success) {
            const newCustomers = res.data || [];
            setCustomers(newCustomers);
            if (prevCustomer) {
              const exists = newCustomers.some(c => c.id === prevCustomer);
              if (exists) setSelectedCustomer(prevCustomer);
            }
          }
        } catch {}
      })().finally(() => setLoading(false));
    }
  }, [currentCompany]);

  // REMOVED AUTO-LOAD ON dateRange CHANGE
  // useEffect(() => {
  //   if (currentCompany) {
  //     loadInvoices();
  //   }
  // }, [currentCompany, dateRange]);

  const loadCustomers = async () => {
    try {
      const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
      if (res.success) setCustomers(res.data || []);
    } catch {
      // ignore
    }
  };

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate = dateRange[1].format('YYYY-MM-DD');
      if (itemName) filters.itemName = itemName;
      if (poNumber) filters.poNumber = poNumber;
      if (brand) filters.brand = brand;
      if (quantity) filters.quantity = quantity;
      if (selectedStatus) filters.status = selectedStatus;

      if (selectedSalesperson) filters.salespersonName = selectedSalesperson;

      const res = await (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id, filters);
      if (res.success) {
        setInvoices(res.data || []);
      } else {
        notification.error({ message: 'Error', description: 'Failed to load invoices' });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load invoices' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = invoices.filter((inv: any) => {
    if (selectedCustomer && inv.customer_id !== selectedCustomer) return false;
    if (selectedSalesperson && inv.customer_salesperson_name !== selectedSalesperson) return false;
    return true;
});

  const totalInvoices = filtered.length;
  const totalSubtotal = filtered.reduce((s, inv) => s + (Number(inv.subtotal) || 0), 0);
  const totalTax = filtered.reduce((s, inv) => s + (Number(inv.gst_total) || 0), 0);
  const totalAmount = filtered.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
  const totalBalance = filtered.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
  const totalPaid = totalAmount - totalBalance;

  const isGst = !!currentCompany?.is_gst_enabled;
  const docLabel = isGst ? 'Invoice' : 'Bill';

  const columns = [
    {
      title: 'Sr.',
      key: 'sr',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: `${docLabel} #`,
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '—',
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Sales Person',
      dataIndex: 'customer_salesperson_name',
      key: 'customer_salesperson_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString(),
    },
    ...(isGst ? [
      {
        title: 'Sales Tax',
        dataIndex: 'gst_total',
        key: 'gst_total',
        align: 'right' as const,
        render: (v: number) => Number(v || 0).toLocaleString(),
      },
    ] : []),
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (v: number) => <Text strong>{Number(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Paid',
      key: 'paid',
      align: 'right' as const,
      render: (_: any, row: any) => {
        const paid = (Number(row.total_amount) || 0) - (Number(row.balance) || 0);
        return Number(paid).toLocaleString();
      },
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => {
        const b = Number(v || 0);
        return <Text type={b > 0 ? 'danger' : undefined}>{b.toLocaleString()}</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusColor[v] || 'default'}>{(v || '').toUpperCase()}</Tag>
      ),
    },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = async () => {
    try {
      const fileName = `Sales_Report_${dayjs().format('YYYY-MM-DD')}.pdf`;
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
    const periodLabel = `${dateRange[0]?.format('DDMMYYYY')}_${dateRange[1]?.format('DDMMYYYY')}`;
    const companyName = currentCompany?.name || 'Company';
    const docLabel = isGst ? 'Invoice' : 'Bill';

    const numCols = isGst ? 10 : 9;

    // ── Styles ──────────────────────────────────────────────────────────────
    const thinBorder = {
      top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
      bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
      left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
      right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
    };
    const thickBottom = {
      top:    { style: 'thin',   color: { rgb: 'AAAAAA' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left:   { style: 'thin',   color: { rgb: 'AAAAAA' } },
      right:  { style: 'thin',   color: { rgb: 'AAAAAA' } },
    };

    const styleCompanyName = {
      font:      { bold: true, sz: 16, color: { rgb: '1F3864' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const styleReportTitle = {
      font:      { bold: true, sz: 13, color: { rgb: '2F5496' } },
      alignment: { horizontal: 'center' },
    };
    const stylePeriod = {
      font:      { sz: 10, italic: true, color: { rgb: '555555' } },
      alignment: { horizontal: 'center' },
    };
    const styleColHeader = {
      font:      { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '2F5496' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border:    thinBorder,
    };
    const styleColHeaderRight = {
      ...styleColHeader,
      alignment: { horizontal: 'right', vertical: 'center' },
    };
    const styleData = {
      font:      { sz: 10 },
      alignment: { vertical: 'center' },
      border:    thinBorder,
    };
    const styleDataRight = {
      font:      { sz: 10 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    thinBorder,
    };
    const styleDataBoldRight = {
      font:      { bold: true, sz: 10 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    thinBorder,
    };
    const styleTotalsLabel = {
      font:      { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '1F3864' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    thickBottom,
    };
    const styleTotalsNum = {
      font:      { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill:      { fgColor: { rgb: '1F3864' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    thickBottom,
    };
    const styleSummaryLabel = {
      font:      { bold: true, sz: 10 },
      fill:      { fgColor: { rgb: 'DCE6F1' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    thinBorder,
    };
    const styleSummaryValue = {
      font:      { bold: true, sz: 10 },
      fill:      { fgColor: { rgb: 'DCE6F1' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    thinBorder,
    };

    const c = (v: any, s: any = {}) => ({ v, s });

    // ── Column headers ────────────────────────────────────────────────────
    const colHeaders = [
      c('Sr.',          styleColHeader),
      c(`${docLabel} #`, styleColHeader),
      c('Date',         styleColHeader),
      c('Customer',     styleColHeader),
      c('Subtotal',     styleColHeaderRight),
      ...(isGst ? [c('Sales Tax', styleColHeaderRight)] : []),
      c('Total Amount', styleColHeaderRight),
      c('Paid',         styleColHeaderRight),
      c('Balance Due',  styleColHeaderRight),
      c('Status',       styleColHeader),
    ];

    // ── Data rows ──────────────────────────────────────────────────────────
    const dataRows = filtered.map((inv, i) => {
      const paid = (Number(inv.total_amount) || 0) - (Number(inv.balance) || 0);
      const bal  = Number(inv.balance) || 0;
      const balStyle = bal > 0
        ? { ...styleDataBoldRight, font: { bold: true, sz: 10, color: { rgb: 'C00000' } } }
        : styleDataRight;
      return [
        c(i + 1,                                               styleData),
        c(inv.invoice_number || '',                            styleData),
        c(inv.invoice_date ? dayjs(inv.invoice_date).format('DD-MM-YYYY') : '', styleData),
        c(inv.customer_name || '',                             styleData),
        c(Number(inv.subtotal) || 0,                          styleDataRight),
        ...(isGst ? [c(Number(inv.gst_total) || 0,            styleDataRight)] : []),
        c(Number(inv.total_amount) || 0,                      styleDataBoldRight),
        c(paid,                                               styleDataRight),
        c(bal,                                                balStyle),
        c((inv.status || '').toUpperCase(),                   styleData),
      ];
    });

    // ── Totals row ─────────────────────────────────────────────────────────
    const totalsRow = [
      c('',                             styleTotalsLabel),
      c('TOTAL',                        styleTotalsLabel),
      c('',                             styleTotalsLabel),
      c(`${totalInvoices} records`,     styleTotalsLabel),
      c(totalSubtotal,                  styleTotalsNum),
      ...(isGst ? [c(totalTax,         styleTotalsNum)] : []),
      c(totalAmount,                    styleTotalsNum),
      c(totalPaid,                      styleTotalsNum),
      c(totalBalance,                   styleTotalsNum),
      c('',                             styleTotalsLabel),
    ];

    // ── Summary block (below table) ─────────────────────────────────────
    const summaryRows = [
      [],
      [c('Summary',         { font: { bold: true, sz: 11 } })],
      [c('Total Records',   styleSummaryLabel), c(''),  c(''), c(totalInvoices,  styleSummaryValue)],
      [c('Total Subtotal',  styleSummaryLabel), c(''),  c(''), c(totalSubtotal,  styleSummaryValue)],
      ...(isGst ? [[c('Total Sales Tax', styleSummaryLabel), c(''), c(''), c(totalTax, styleSummaryValue)]] : []),
      [c('Grand Total',     styleSummaryLabel), c(''),  c(''), c(totalAmount,    styleSummaryValue)],
      [c('Total Received',  styleSummaryLabel), c(''),  c(''), c(totalPaid,      styleSummaryValue)],
      [c('Total Balance',   styleSummaryLabel), c(''),  c(''), c(totalBalance,   styleSummaryValue)],
    ];

    // ── Assemble sheet ────────────────────────────────────────────────────
    const wsData: any[][] = [
      [c(companyName, styleCompanyName)],
      [c('Sales Report', styleReportTitle)],
      [c(`Period: ${dateRange[0]?.format('DD-MM-YYYY')} — ${dateRange[1]?.format('DD-MM-YYYY')}`, stylePeriod)],
      [],
      colHeaders,
      ...dataRows,
      totalsRow,
      ...summaryRows,
    ];

    const ws: any = XLSXStyle.utils.aoa_to_sheet(wsData);

    // Merge company name & title across all columns
    const lastCol = numCols - 1;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 13 }, { wch: 28 }, { wch: 14 },
      ...(isGst ? [{ wch: 12 }] : []),
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];

    // Row heights
    ws['!rows'] = [
      { hpt: 26 },  // company name
      { hpt: 20 },  // report title
      { hpt: 16 },  // period
      { hpt: 6  },  // blank
      { hpt: 22 },  // col headers
    ];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSXStyle.writeFile(wb, `Sales_Report_${periodLabel}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={4} align="right">
          <Text strong>Total ({totalInvoices} records)</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">
          {totalSubtotal.toLocaleString()}
        </Table.Summary.Cell>
        {isGst && (
          <Table.Summary.Cell index={2} align="right">
            {totalTax.toLocaleString()}
          </Table.Summary.Cell>
        )}
        <Table.Summary.Cell index={isGst ? 3 : 2} align="right">
          <Text strong>{totalAmount.toLocaleString()}</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 4 : 3} align="right">
          {totalPaid.toLocaleString()}
        </Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 5 : 4} align="right">
          <Text type={totalBalance > 0 ? 'danger' : undefined} strong>
            {totalBalance.toLocaleString()}
          </Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={isGst ? 6 : 5} />
      </Table.Summary.Row>
    </Table.Summary>
  );

  return (
    <div>
      {/* Screen controls - hidden on print */}
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>
              Back
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              Sales Report — {currentCompany?.name}
            </Title>
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Export Excel
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
            <Button type="primary" onClick={handleSavePDF}>
              Save as PDF
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
              }}
              format="DD-MM-YYYY"
            />
            <Select
              allowClear
              placeholder="All Customers"
              style={{ width: 180 }}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              options={customers.map((c: any) => ({ label: c.name, value: c.id }))}
              showSearch
              optionFilterProp="label"
            />
            

... // later in JSX
<Select
  allowClear
  placeholder="All Sales Persons"
  style={{ width: 180 }}
  value={selectedSalesperson}
  onChange={setSelectedSalesperson}
  options={salesPersonOptions}
  showSearch
  optionFilterProp="label"
/>
             <Select
               allowClear
               placeholder="All Status"
               style={{ width: 180 }}
               value={selectedStatus}
               onChange={setSelectedStatus}
               options={Object.keys(statusColor).map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
               showSearch
               optionFilterProp="label"
             />
            <Input
              placeholder="Item Name"
              style={{ width: 130 }}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              allowClear
            />
            <Input
              placeholder="P.O Number"
              style={{ width: 130 }}
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Brand"
              style={{ width: 110 }}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Qty"
              style={{ width: 80 }}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              allowClear
            />
            <Input
              placeholder="Price"
              style={{ width: 90 }}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              allowClear
            />
            <Button type="primary" onClick={loadInvoices}>Search</Button>
          </Space>
        </Card>

        {/* KPI Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Total Documents"
                value={totalInvoices}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Subtotal"
                value={totalSubtotal}
                precision={0}
                prefix={<BarChartOutlined />}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          {isGst && (
            <Col xs={12} sm={8} md={5}>
              <Card size="small">
                <Statistic
                  title="Sales Tax"
                  value={totalTax}
                  precision={0}
                  formatter={(v) => Number(v).toLocaleString()}
                />
              </Card>
            </Col>
          )}
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Total Amount"
                value={totalAmount}
                precision={0}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1890ff' }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Received"
                value={totalPaid}
                precision={0}
                valueStyle={{ color: '#52c41a' }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Balance Due"
                value={totalBalance}
                precision={0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: totalBalance > 0 ? '#ff4d4f' : undefined }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Printable area */}
      <div ref={printRef}>
        {/* Print header */}
        <div className="print-only" style={{ marginBottom: 16 }}>
          <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
          <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Sales Report</Title>
          <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>
            Period: {dateRange[0]?.format('DD-MM-YYYY')} — {dateRange[1]?.format('DD-MM-YYYY')}
            {selectedCustomer && ` | Customer: ${customers.find(c => c.id === selectedCustomer)?.name}`}
          </Text>
          <Divider style={{ margin: '8px 0' }} />
          {/* Print summary row */}
          <Row gutter={[24, 8]} style={{ marginBottom: 12 }}>
            <Col span={4}><Text>Records: <strong>{totalInvoices}</strong></Text></Col>
            <Col span={5}><Text>Subtotal: <strong>{totalSubtotal.toLocaleString()}</strong></Text></Col>
            {isGst && <Col span={5}><Text>Tax: <strong>{totalTax.toLocaleString()}</strong></Text></Col>}
            <Col span={5}><Text>Total: <strong>{totalAmount.toLocaleString()}</strong></Text></Col>
            <Col span={5}><Text>Balance: <strong>{totalBalance.toLocaleString()}</strong></Text></Col>
          </Row>
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          bordered
          summary={summaryRow}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* PDF Capture container */}
      <div id="report-pdf-container" style={{ display: 'none' }}>
        <ReportTablePdfDocument
          reportTitle="Sales Report"
          companyName={currentCompany?.name || '-'}
          periodLabel={`Period: ${dateRange[0]?.format('DD-MM-YYYY')} — ${dateRange[1]?.format('DD-MM-YYYY')}`}
          columns={[
            { title: 'Date', dataIndex: 'invoice_date', align: 'center' as const, render: (v) => dayjs(v).format('DD-MM-YYYY') },
            { title: 'Invoice #', dataIndex: 'invoice_number', align: 'left' as const },
            { title: 'Customer', dataIndex: 'customer_name', align: 'left' as const },
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
          body { margin: 0; }
          .app-sider, .app-header { display: none !important; }
          .app-layout { margin: 0 !important; }
          .app-content { padding: 0 !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
};

export default SalesReport;
