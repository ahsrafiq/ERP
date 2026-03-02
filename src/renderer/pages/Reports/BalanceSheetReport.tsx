import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, DatePicker, Button, Space,
  Statistic, Divider, Typography, message, Table,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { Title, Text } = Typography;

const BalanceSheetReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState<any>(dayjs());

  // Assets
  const [receivables, setReceivables] = useState(0);   // sum of customer balances > 0
  const [inventoryVal, setInventoryVal] = useState(0); // sum of qty * purchase_price
  const [advancePaid, setAdvancePaid] = useState(0);   // customer balances < 0 = overpaid = asset

  // Liabilities
  const [payables, setPayables] = useState(0);         // sum of vendor balances > 0
  const [advanceRcvd, setAdvanceRcvd] = useState(0);   // customer advances received = liability

  // P&L
  const [netProfit, setNetProfit] = useState(0);

  // Breakdown rows
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors]     = useState<any[]>([]);
  const [items, setItems]         = useState<any[]>([]);

  useEffect(() => {
    if (currentCompany) loadData();
  }, [currentCompany, asOfDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cid  = currentCompany!.id;
      const from = '2000-01-01';
      const to   = asOfDate.format('YYYY-MM-DD');

      const [custRes, vendRes, itemRes, kpiRes] = await Promise.all([
        (window as any).electronAPI.db.customers.getAll(cid),
        (window as any).electronAPI.db.vendors.getAll(cid),
        (window as any).electronAPI.db.items.getAll(cid),
        (window as any).electronAPI.db.dashboard.getKPIs(cid, { fromDate: from, toDate: to }),
      ]);

      if (custRes.success) {
        const custs = custRes.data || [];
        setCustomers(custs);
        setReceivables(custs.filter((c: any) => Number(c.balance) > 0).reduce((s: number, c: any) => s + Number(c.balance), 0));
        setAdvanceRcvd(custs.filter((c: any) => Number(c.balance) < 0).reduce((s: number, c: any) => s + Math.abs(Number(c.balance)), 0));
      }

      if (vendRes.success) {
        const vends = vendRes.data || [];
        setVendors(vends);
        setPayables(vends.filter((v: any) => Number(v.balance) > 0).reduce((s: number, v: any) => s + Number(v.balance), 0));
        setAdvancePaid(vends.filter((v: any) => Number(v.balance) < 0).reduce((s: number, v: any) => s + Math.abs(Number(v.balance)), 0));
      }

      if (itemRes.success) {
        const its = itemRes.data || [];
        setItems(its);
        setInventoryVal(its.reduce((s: number, i: any) => s + (Number(i.quantity || 0) * Number(i.purchase_price || 0)), 0));
      }

      if (kpiRes.success) {
        setNetProfit(kpiRes.data.netProfit || 0);
      }
    } catch {
      message.error('Failed to load Balance Sheet data');
    } finally {
      setLoading(false);
    }
  };

  const totalAssets      = receivables + inventoryVal + advancePaid;
  const totalLiabilities = payables + advanceRcvd;
  const equity           = totalAssets - totalLiabilities;

  // Statement rows
  const makeSection = (label: string) => ({ key: label, label, isSection: true, amount: null });
  const makeRow     = (key: string, label: string, amount: number, indent = false) => ({ key, label: indent ? `   ${label}` : label, isSection: false, amount });
  const makeTotal   = (key: string, label: string, amount: number) => ({ key, label, isSection: false, isTotal: true, amount });

  const bsRows = [
    makeSection('ASSETS'),
    makeRow('receivables',   'Accounts Receivable (Customer Balances)', receivables),
    makeRow('inventory',     'Inventory (at Cost)',                      inventoryVal),
    ...(advancePaid > 0 ? [makeRow('adv_paid', 'Advance Payments to Vendors', advancePaid)] : []),
    makeTotal('total_assets', 'TOTAL ASSETS', totalAssets),
    makeSection('LIABILITIES'),
    makeRow('payables',    'Accounts Payable (Vendor Balances)',    payables),
    ...(advanceRcvd > 0 ? [makeRow('adv_rcvd', 'Advance Receipts from Customers', advanceRcvd)] : []),
    makeTotal('total_liab', 'TOTAL LIABILITIES', totalLiabilities),
    makeSection("OWNER'S EQUITY"),
    makeRow('retained',  'Retained Earnings (Net Profit / Loss)',   netProfit),
    makeRow('eq_calc',   'Equity = Assets − Liabilities',          equity, false),
    makeTotal('total_eq', "TOTAL EQUITY", equity),
    makeSection('BALANCE CHECK'),
    makeTotal('check', 'Liabilities + Equity', totalLiabilities + equity),
  ];

  const columns: any[] = [
    {
      title: 'Particulars', dataIndex: 'label', key: 'label',
      render: (v: string, row: any) => {
        if (row.isSection) return <Text strong style={{ color: '#1890ff', textTransform: 'uppercase', fontSize: 13 }}>{v}</Text>;
        if (row.isTotal)   return <Text strong>{v}</Text>;
        return <Text>{v}</Text>;
      },
    },
    {
      title: `As of ${asOfDate.format('DD-MMM-YYYY')}`, dataIndex: 'amount', key: 'amount',
      align: 'right' as const, width: 200,
      render: (v: number, row: any) => {
        if (v === null) return null;
        const formatted = Number(v).toLocaleString();
        if (row.isTotal) {
          const color = row.key === 'total_assets' ? '#52c41a' : row.key === 'total_liab' ? '#cf1322' : '#1890ff';
          return <Text strong style={{ color }}>{formatted}</Text>;
        }
        return <Text>{formatted}</Text>;
      },
    },
  ];

  const custWithBalance  = customers.filter((c: any) => Number(c.balance) !== 0);
  const vendWithBalance  = vendors.filter((v: any) => Number(v.balance) !== 0);
  const itemsWithStock   = items.filter((i: any) => Number(i.quantity || 0) > 0);

  const handleExportExcel = () => {
    const compName = currentCompany?.name || 'Company';
    const asOf     = `As of ${asOfDate.format('DD-MMM-YYYY')}`;

    const sHdr    = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThin   = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThinR  = { ...sThin, alignment: { horizontal: 'right' } };
    const sTot    = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }, fill: { fgColor: { rgb: 'F0F4FF' } } };
    const sTotR   = { ...sTot, alignment: { horizontal: 'right' } };
    const sSection = { font: { bold: true, color: { rgb: '1890FF' } }, fill: { fgColor: { rgb: 'EDF5FF' } } };
    const c = (v: any, s: any) => ({ v, s });

    const rows: any[][] = [];
    rows.push([c(compName, { font: { bold: true, sz: 14 } })]);
    rows.push([c('Balance Sheet', { font: { bold: true, sz: 12 } })]);
    rows.push([c(asOf, { font: { italic: true } })]);
    rows.push([]);
    rows.push([c('Particulars', sHdr), c(asOf, { ...sHdr, alignment: { horizontal: 'right' } })]);

    bsRows.forEach((row) => {
      if (row.amount === null) {
        rows.push([c(row.label, sSection), c('', sSection)]);
      } else if (row.isTotal) {
        rows.push([c(row.label, sTot), c(Number(row.amount).toLocaleString(), sTotR)]);
      } else {
        rows.push([c(row.label, sThin), c(Number(row.amount).toLocaleString(), sThinR)]);
      }
    });

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
    ws['!cols'] = [{ wch: 45 }, { wch: 20 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSXStyle.writeFile(wb, `BalanceSheet_${asOfDate.format('YYYYMMDD')}.xlsx`);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>Balance Sheet</Title>
        </Space>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ color: '#217346', borderColor: '#217346' }}>Export Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>As of Date:</Text>
          <DatePicker value={asOfDate} onChange={(d) => d && setAsOfDate(d)} format="DD-MMM-YYYY" />
          <Button type="primary" onClick={loadData} loading={loading}>Refresh</Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card style={{ background: '#f6ffed' }}>
            <Statistic
              title="Total Assets"
              value={totalAssets}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ background: '#fff1f0' }}>
            <Statistic
              title="Total Liabilities"
              value={totalLiabilities}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ background: '#e6f4ff' }}>
            <Statistic
              title="Owner's Equity"
              value={Math.abs(equity)}
              precision={0}
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: equity >= 0 ? '#1890ff' : '#cf1322', fontWeight: 'bold' }}
              suffix={equity < 0 ? <Text type="danger" style={{ fontSize: 14 }}> (Deficit)</Text> : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Balance Sheet Statement" loading={loading}>
            <Table
              dataSource={bsRows}
              columns={columns}
              pagination={false}
              showHeader={false}
              rowKey="key"
              size="small"
              rowClassName={(row: any) => {
                if (row.isSection) return 'pl-section-header';
                if (row.isTotal)   return 'pl-total-row';
                return '';
              }}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Customer Balances (AR)" size="small" style={{ marginBottom: 12 }} loading={loading}>
            {custWithBalance.length > 0 ? (
              <Table
                dataSource={custWithBalance}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5, simple: true }}
                columns={[
                  { title: 'Customer', dataIndex: 'name', key: 'name' },
                  {
                    title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right' as const,
                    render: (v: number) => (
                      <Text style={{ color: Number(v) > 0 ? '#cf1322' : '#1890ff' }}>
                        {Number(Math.abs(v)).toLocaleString()} {Number(v) < 0 ? '(Adv)' : ''}
                      </Text>
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0}>Total Receivable</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text style={{ color: '#cf1322' }}>{receivables.toLocaleString()}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ) : <Text type="secondary">No outstanding customer balances.</Text>}
          </Card>

          <Card title="Vendor Balances (AP)" size="small" style={{ marginBottom: 12 }} loading={loading}>
            {vendWithBalance.length > 0 ? (
              <Table
                dataSource={vendWithBalance}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5, simple: true }}
                columns={[
                  { title: 'Vendor', dataIndex: 'name', key: 'name' },
                  {
                    title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right' as const,
                    render: (v: number) => (
                      <Text style={{ color: Number(v) > 0 ? '#cf1322' : '#1890ff' }}>
                        {Number(Math.abs(v)).toLocaleString()} {Number(v) < 0 ? '(Adv)' : ''}
                      </Text>
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0}>Total Payable</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text style={{ color: '#cf1322' }}>{payables.toLocaleString()}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ) : <Text type="secondary">No outstanding vendor balances.</Text>}
          </Card>

          <Card title="Inventory Value" size="small" loading={loading}>
            {itemsWithStock.length > 0 ? (
              <Table
                dataSource={itemsWithStock.slice(0, 10)}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Item', dataIndex: 'name', key: 'name' },
                  { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
                  {
                    title: 'Value', key: 'value', align: 'right' as const,
                    render: (_: any, row: any) => ((Number(row.quantity || 0) * Number(row.purchase_price || 0)).toLocaleString()),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0} colSpan={2}>Total (showing top {Math.min(10, itemsWithStock.length)} of {itemsWithStock.length})</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{inventoryVal.toLocaleString()}</Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ) : <Text type="secondary">No inventory in stock.</Text>}
          </Card>
        </Col>
      </Row>

      <Divider />
      <Text type="secondary" style={{ fontSize: 11 }}>
        Generated on {dayjs().format('DD-MMM-YYYY HH:mm')} · {currentCompany?.name}
      </Text>
    </div>
  );
};

export default BalanceSheetReport;
