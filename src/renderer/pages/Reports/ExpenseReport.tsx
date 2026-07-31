import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Card, Row, Col, DatePicker, Select, Button, Space,
  Tag, Statistic, Divider, Typography, notification,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  DollarOutlined, FileTextOutlined, TagsOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  approved: 'green',
  pending: 'orange',
  rejected: 'red',
};

const ExpenseReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany) {
      const prevCategory = selectedCategory;
      const prevStatus = selectedStatus;
      setLoading(true);
      setCategories([]);
      setSelectedCategory(null);
      setSelectedStatus(null);
      setExpenses([]);
      (async () => {
        try {
          const newCategories = await loadMeta();
          if (prevCategory) {
            const exists = newCategories.some((c: any) => c.id === prevCategory);
            if (exists) setSelectedCategory(prevCategory);
          }
          if (prevStatus) {
            setSelectedStatus(prevStatus);
          }
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [currentCompany]);

  useEffect(() => {
    // loadExpenses(); // Removed auto-load
  }, [currentCompany, dateRange]);

  const loadMeta = async () => {
    try {
      const catRes = await (window as any).electronAPI.db.expenses.getCategories(currentCompany!.id);
      if (catRes.success) {
        setCategories(catRes.data || []);
        return catRes.data || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.db.expenses.getAll(currentCompany!.id, {
        fromDate: dateRange[0].format('YYYY-MM-DD'),
        toDate: dateRange[1].format('YYYY-MM-DD'),
      });
      if (res.success) setExpenses(res.data || []);
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load expenses', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const filtered = expenses.filter((e) => {
    if (selectedCategory && e.category_id !== selectedCategory) return false;
    if (selectedStatus && e.status !== selectedStatus) return false;
    return true;
  });

  const totalAmount  = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalTax     = filtered.reduce((s, e) => s + Number(e.tax_amount || 0), 0);
  const totalNet     = filtered.reduce((s, e) => s + Number(e.total_amount || 0), 0);

  // Category breakdown
  const byCategory: Record<string, number> = {};
  filtered.forEach((e) => {
    const cat = e.category_name || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.total_amount || 0);
  });

  const columns: any[] = [
    { title: 'Sr.', key: 'sr', align: 'center' as const, width: 55, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Expense #', dataIndex: 'expense_number', key: 'expense_number' },
    { title: 'Date', dataIndex: 'expense_date', key: 'expense_date', render: (v: string) => v ? dayjs(v).format('DD-MMM-YY') : '—' },
    { title: 'Category', dataIndex: 'category_name', key: 'category_name', render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name', render: (v: string) => v || '—' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => v || '—' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Tax', dataIndex: 'tax_amount', key: 'tax_amount', align: 'right' as const, render: (v: number) => Number(v || 0) > 0 ? Number(v).toLocaleString() : '—' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', align: 'right' as const, render: (v: number) => <Text strong>{Number(v || 0).toLocaleString()}</Text> },
    {
      title: 'Status', dataIndex: 'status', key: 'status', align: 'center' as const,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{(v || '—').toUpperCase()}</Tag>,
    },
  ];

  const handlePrint = () => {
    if (printRef.current) window.print();
  };

  const handleExportExcel = () => {
    const compName = currentCompany?.name || 'Company';
    const period = `${dateRange[0].format('DD-MMM-YY')} to ${dateRange[1].format('DD-MMM-YY')}`;

    const sBold = { font: { bold: true } };
    const sHdr = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center' } };
    const sThin = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThinR = { ...sThin, alignment: { horizontal: 'right' } };
    const sTot = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }, fill: { fgColor: { rgb: 'F0F4FF' } } };
    const sTotR = { ...sTot, alignment: { horizontal: 'right' } };
    const c = (v: any, s: any = {}) => ({ v, s });

    const rows: any[][] = [];
    rows.push([c(compName, { font: { bold: true, sz: 14 } })]);
    rows.push([c('Expense Report', { font: { bold: true, sz: 12 } })]);
    rows.push([c(`Period: ${period}`, { font: { italic: true } })]);
    rows.push([]);

    const headers = ['Sr.', 'Expense #', 'Date', 'Category', 'Vendor', 'Description', 'Amount', 'Tax', 'Total', 'Status'];
    rows.push(headers.map(h => c(h, sHdr)));

    filtered.forEach((e, i) => {
      rows.push([
        c(i + 1, { ...sThin, alignment: { horizontal: 'center' } }),
        c(e.expense_number || '', sThin),
        c(e.expense_date ? dayjs(e.expense_date).format('DD-MMM-YY') : '', sThin),
        c(e.category_name || '', sThin),
        c(e.vendor_name || '', sThin),
        c(e.description || '', sThin),
        c(Number(e.amount || 0), sThinR),
        c(Number(e.tax_amount || 0), sThinR),
        c(Number(e.total_amount || 0), sThinR),
        c((e.status || '').toUpperCase(), { ...sThin, alignment: { horizontal: 'center' } }),
      ]);
    });

    rows.push([
      c('', sTot), c('', sTot), c('', sTot), c('', sTot), c('', sTot),
      c('TOTAL', sTot), c(totalAmount, sTotR), c(totalTax, sTotR), c(totalNet, sTotR), c('', sTot),
    ]);

    rows.push([]);
    rows.push([c('Category Breakdown', sBold)]);
    Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      rows.push([c(cat, sThin), c('', sThin), c('', sThin), c('', sThin), c('', sThin), c('', sThin), c('', sThin), c('', sThin), c(amt, sThinR)]);
    });

    const ws: any = {};
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
        ws[addr] = cell;
      });
    });
    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: headers.length - 1 } });
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    ];
    ws['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 13 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Expense Report');
    XLSXStyle.writeFile(wb, `Expense_Report_${dateRange[0].format('YYYYMMDD')}_${dateRange[1].format('YYYYMMDD')}.xlsx`);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>Expense Report</Title>
        </Space>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ color: '#217346', borderColor: '#217346' }}>Export Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker value={dateRange} onChange={(d) => d && d[0] && d[1] && setDateRange([d[0], d[1]])} format="DD-MMM-YYYY" />
          <Select allowClear placeholder="All Categories" style={{ width: 180 }} value={selectedCategory} onChange={setSelectedCategory}
            options={categories.map((c: any) => ({ label: c.name, value: c.id }))} />
          <Select allowClear placeholder="All Statuses" style={{ width: 150 }} value={selectedStatus} onChange={setSelectedStatus}
            options={[{ label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Rejected', value: 'rejected' }]} />
          <Button type="primary" onClick={loadExpenses}>Search</Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="Total Records" value={filtered.length} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Amount" value={totalAmount} precision={0} prefix={<DollarOutlined />} formatter={(v) => Number(v).toLocaleString()} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Tax" value={totalTax} precision={0} prefix={<DollarOutlined />} formatter={(v) => Number(v).toLocaleString()} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Net Total" value={totalNet} precision={0} prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322' }} formatter={(v) => Number(v).toLocaleString()} /></Card>
        </Col>
      </Row>

      {Object.keys(byCategory).length > 0 && (
        <Card title={<><TagsOutlined /> Category Breakdown</>} style={{ marginBottom: 16 }} size="small">
          <Row gutter={8}>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <Col key={cat}>
                <Tag color="blue" style={{ marginBottom: 4, fontSize: 13, padding: '2px 10px' }}>
                  {cat}: <strong>{Number(amt).toLocaleString()}</strong>
                </Tag>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <div ref={printRef}>
        <div className="print-only-header" style={{ display: 'none' }}>
          <h2>{currentCompany?.name} — Expense Report</h2>
          <p>Period: {dateRange[0].format('DD-MMM-YYYY')} to {dateRange[1].format('DD-MMM-YYYY')}</p>
        </div>
        <Table
          dataSource={filtered}
          columns={columns}
          loading={loading}
          rowKey="id"
          size="small"
          bordered
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          summary={() => (
            <Table.Summary.Row style={{ fontWeight: 'bold', background: '#f0f4ff' }}>
              <Table.Summary.Cell index={0} colSpan={6} align="right">TOTAL</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{totalAmount.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">{totalTax.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">{totalNet.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
            </Table.Summary.Row>
          )}
        />
      </div>

      <Divider />
      <Text type="secondary" style={{ fontSize: 11 }}>
        Generated on {dayjs().format('DD-MMM-YYYY HH:mm')} · {currentCompany?.name}
      </Text>
    </div>
  );
};

export default ExpenseReport;
