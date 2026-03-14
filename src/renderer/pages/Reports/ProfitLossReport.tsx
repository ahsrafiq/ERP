import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, DatePicker, Button, Space,
  Statistic, Divider, Typography, notification, Table, Tag,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  RiseOutlined, FallOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ProfitLossReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('year'),
    dayjs().endOf('year'),
  ]);

  const [salesTotal, setSalesTotal]       = useState(0);
  const [salesGst, setSalesGst]           = useState(0);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [expenseRows, setExpenseRows]     = useState<{ category: string; amount: number }[]>([]);
  const [expenseTotal, setExpenseTotal]   = useState(0);
  const [monthlyData, setMonthlyData]     = useState<any[]>([]);

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const from = dateRange[0].format('YYYY-MM-DD');
      const to   = dateRange[1].format('YYYY-MM-DD');
      const cid  = currentCompany!.id;

      const [kpiRes, expBreakRes, monthlyRes] = await Promise.all([
        (window as any).electronAPI.db.dashboard.getKPIs(cid, { fromDate: from, toDate: to }),
        (window as any).electronAPI.db.dashboard.getExpenseBreakdown(cid, { fromDate: from, toDate: to }),
        (window as any).electronAPI.db.dashboard.getMonthlyRevenue(cid, { fromDate: from, toDate: to }),
      ]);

      if (kpiRes.success) {
        setSalesTotal(kpiRes.data.totalSales || 0);
        setPurchaseTotal(kpiRes.data.totalPurchases || 0);
        setExpenseTotal(kpiRes.data.totalExpenses || 0);
      }

      // Also load raw invoices to get GST total
      const invRes = await (window as any).electronAPI.db.salesInvoices.getAll(cid, {
        fromDate: from, toDate: to,
      });
      if (invRes.success) {
        const gst = (invRes.data || [])
          .filter((i: any) => i.status === 'finalized')
          .reduce((s: number, i: any) => s + Number(i.gst_total || 0), 0);
        setSalesGst(gst);
      }

      if (expBreakRes.success) {
        setExpenseRows(expBreakRes.data || []);
      }

      if (monthlyRes.success) {
        setMonthlyData(monthlyRes.data || []);
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load P&L data', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const grossProfit = salesTotal - purchaseTotal;
  const netProfit   = grossProfit - expenseTotal;
  const grossMargin = salesTotal > 0 ? (grossProfit / salesTotal) * 100 : 0;
  const netMargin   = salesTotal > 0 ? (netProfit   / salesTotal) * 100 : 0;

  const plRows = [
    { key: 'income_hdr',   label: 'INCOME', isHeader: true,  amount: null },
    { key: 'sales',        label: 'Sales Revenue (Incl. Tax)', isHeader: false, amount: salesTotal },
    ...(currentCompany?.is_gst_enabled && salesGst > 0 ? [
      { key: 'sales_gst', label: '  └ GST / Sales Tax Collected', isHeader: false, amount: salesGst },
      { key: 'sales_net', label: '  └ Net Sales (Excl. Tax)', isHeader: false, amount: salesTotal - salesGst },
    ] : []),
    { key: 'total_income', label: 'Total Income', isHeader: false, isTotal: true, amount: salesTotal },
    { key: 'cogs_hdr',    label: 'COST OF GOODS', isHeader: true, amount: null },
    { key: 'purchases',   label: 'Purchase Cost', isHeader: false, amount: purchaseTotal },
    { key: 'gross',       label: 'GROSS PROFIT', isHeader: false, isTotal: true, amount: grossProfit },
    { key: 'exp_hdr',     label: 'OPERATING EXPENSES', isHeader: true, amount: null },
    ...expenseRows.map((e) => ({ key: `exp_${e.category}`, label: `  ${e.category}`, isHeader: false, amount: e.amount })),
    { key: 'total_exp',   label: 'Total Expenses', isHeader: false, isTotal: true, amount: expenseTotal },
    { key: 'net',         label: 'NET PROFIT / (LOSS)', isHeader: false, isNet: true, amount: netProfit },
  ];

  const columns: any[] = [
    {
      title: 'Particulars', dataIndex: 'label', key: 'label',
      render: (v: string, row: any) => {
        if (row.isHeader) return <Text strong style={{ fontSize: 13, textTransform: 'uppercase', color: '#1890ff' }}>{v}</Text>;
        if (row.isNet)    return <Text strong style={{ fontSize: 14 }}>{v}</Text>;
        if (row.isTotal)  return <Text strong>{v}</Text>;
        return <Text>{v}</Text>;
      },
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 200,
      render: (v: number, row: any) => {
        if (v === null) return null;
        const formatted = Number(v).toLocaleString();
        if (row.isNet) {
          return (
            <Text strong style={{ fontSize: 14, color: v >= 0 ? '#52c41a' : '#cf1322' }}>
              {v < 0 ? `(${Math.abs(v).toLocaleString()})` : formatted}
            </Text>
          );
        }
        if (row.isTotal) return <Text strong>{formatted}</Text>;
        if (row.key === 'purchases' || row.key === 'total_exp')
          return <Text style={{ color: '#cf1322' }}>{formatted}</Text>;
        return <Text>{formatted}</Text>;
      },
    },
  ];

  const monthlyColumns: any[] = [
    { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => dayjs(v + '-01').format('MMMM YYYY') },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', align: 'right' as const, render: (v: number) => Number(v).toLocaleString() },
  ];

  const handleExportExcel = () => {
    const compName = currentCompany?.name || 'Company';
    const period   = `${dateRange[0].format('DD-MMM-YY')} to ${dateRange[1].format('DD-MMM-YY')}`;

    const sHdrBlue = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThin  = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThinR = { ...sThin, alignment: { horizontal: 'right' } };
    const sTot   = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }, fill: { fgColor: { rgb: 'F0F4FF' } } };
    const sTotR  = { ...sTot, alignment: { horizontal: 'right' } };
    const sNet   = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: netProfit >= 0 ? 'E6F4EA' : 'FDECEA' } }, border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sNetR  = { ...sNet, alignment: { horizontal: 'right' } };
    const sSection = { font: { bold: true, color: { rgb: '1890FF' } }, fill: { fgColor: { rgb: 'EDF5FF' } } };
    const c = (v: any, s: any = {}) => ({ v, s });

    const rows: any[][] = [];
    rows.push([c(compName, { font: { bold: true, sz: 14 } })]);
    rows.push([c('Profit & Loss Statement', { font: { bold: true, sz: 12 } })]);
    rows.push([c(`Period: ${period}`, { font: { italic: true } })]);
    rows.push([]);
    rows.push([c('Particulars', sHdrBlue), c('Amount', { ...sHdrBlue, alignment: { horizontal: 'right' } })]);

    plRows.forEach((row) => {
      if (row.amount === null) {
        rows.push([c(row.label, sSection), c('', sSection)]);
      } else if (row.isNet) {
        rows.push([c(row.label, sNet), c(row.amount < 0 ? `(${Math.abs(row.amount).toLocaleString()})` : Number(row.amount).toLocaleString(), sNetR)]);
      } else if (row.isTotal) {
        rows.push([c(row.label, sTot), c(Number(row.amount).toLocaleString(), sTotR)]);
      } else {
        rows.push([c(row.label, sThin), c(Number(row.amount).toLocaleString(), sThinR)]);
      }
    });

    rows.push([]);
    rows.push([c('Key Ratios', { font: { bold: true } })]);
    rows.push([c('Gross Profit Margin', sThin), c(`${grossMargin.toFixed(1)}%`, sThinR)]);
    rows.push([c('Net Profit Margin', sThin), c(`${netMargin.toFixed(1)}%`, sThinR)]);

    const ws: any = {};
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        ws[XLSXStyle.utils.encode_cell({ r: ri, c: ci })] = cell;
      });
    });
    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 1 } });
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    ];
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'P&L');
    XLSXStyle.writeFile(wb, `ProfitLoss_${dateRange[0].format('YYYYMMDD')}_${dateRange[1].format('YYYYMMDD')}.xlsx`);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>Profit &amp; Loss Statement</Title>
        </Space>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ color: '#217346', borderColor: '#217346' }}>Export Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker value={dateRange} onChange={(d) => d && d[0] && d[1] && setDateRange([d[0], d[1]])} format="DD-MMM-YYYY" />
          <Button type="primary" onClick={loadData} loading={loading}>Refresh</Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={salesTotal}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Gross Profit"
              value={grossProfit}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              prefix={<DollarOutlined />}
              suffix={<Tag color={grossProfit >= 0 ? 'green' : 'red'} style={{ marginLeft: 8 }}>{grossMargin.toFixed(1)}%</Tag>}
              valueStyle={{ color: grossProfit >= 0 ? '#52c41a' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Expenses"
              value={expenseTotal}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              prefix={<FallOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ background: netProfit >= 0 ? '#f6ffed' : '#fff1f0' }}>
            <Statistic
              title={netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
              value={Math.abs(netProfit)}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              suffix={<Tag color={netProfit >= 0 ? 'green' : 'red'} style={{ marginLeft: 8 }}>{netMargin.toFixed(1)}%</Tag>}
              valueStyle={{ color: netProfit >= 0 ? '#52c41a' : '#cf1322', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="Profit & Loss Statement" loading={loading}>
            <Table
              dataSource={plRows}
              columns={columns}
              pagination={false}
              showHeader={false}
              rowKey="key"
              size="small"
              rowClassName={(row) => {
                if (row.isHeader) return 'pl-section-header';
                if (row.isNet)    return 'pl-net-row';
                if (row.isTotal)  return 'pl-total-row';
                return '';
              }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="Monthly Revenue" loading={loading} style={{ marginBottom: 16 }}>
            {monthlyData.length > 0 ? (
              <Table
                dataSource={monthlyData}
                columns={monthlyColumns}
                pagination={false}
                rowKey="month"
                size="small"
                summary={() => (
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      {monthlyData.reduce((s, r) => s + Number(r.revenue || 0), 0).toLocaleString()}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ) : <Text type="secondary">No revenue data for this period.</Text>}
          </Card>

          {expenseRows.length > 0 && (
            <Card title="Expenses by Category" loading={loading}>
              <Table
                dataSource={expenseRows}
                columns={[
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => Number(v).toLocaleString() },
                ]}
                pagination={false}
                rowKey="category"
                size="small"
                summary={() => (
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{expenseTotal.toLocaleString()}</Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Divider />
      <Text type="secondary" style={{ fontSize: 11 }}>
        Generated on {dayjs().format('DD-MMM-YYYY HH:mm')} · {currentCompany?.name}
      </Text>
    </div>
  );
};

export default ProfitLossReport;
