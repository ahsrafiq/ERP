import React, { useState, useEffect } from 'react';
import {
  Table, Card, DatePicker, Select, Button, Space,
  Typography, notification, message, Statistic, Row, Col, Tabs, Divider
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileTextOutlined,
  FileExcelOutlined, SearchOutlined, DollarOutlined, UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const SalesBySalesPersonReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string>('All');

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate = dateRange[1].format('YYYY-MM-DD');

      const res = await (window as any).electronAPI.db.salesInvoices.getSalesByItem(currentCompany.id, filters);
      if (res.success) {
        const rawData = res.data || [];
        setData(rawData);
        
        // Extract unique salespeople
        const names = Array.from(new Set(rawData.map((r: any) => r.salesperson_name).filter(Boolean))) as string[];
        setSalespeople(names);
      } else {
        notification.error({ message: 'Error', description: res.error || 'Failed to load report data' });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load report data' });
    } finally {
      setLoading(false);
    }
  };

  // Grouping logic
  const summaryData = salespeople.map(name => {
    const personSales = data.filter(r => r.salesperson_name === name);
    return {
      name,
      invoiceCount: new Set(personSales.map(r => r.invoice_id)).size,
      totalQty: personSales.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
      totalGst: personSales.reduce((sum, r) => sum + (Number(r.gst_amount) || 0), 0),
      totalAmount: personSales.reduce((sum, r) => sum + (Number(r.line_total) || 0), 0),
    };
  });

  // Include "Unassigned" if there are any
  const unassignedSales = data.filter(r => !r.salesperson_name);
  if (unassignedSales.length > 0) {
    summaryData.push({
      name: 'Unassigned',
      invoiceCount: new Set(unassignedSales.map(r => r.invoice_id)).size,
      totalQty: unassignedSales.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
      totalGst: unassignedSales.reduce((sum, r) => sum + (Number(r.gst_amount) || 0), 0),
      totalAmount: unassignedSales.reduce((sum, r) => sum + (Number(r.line_total) || 0), 0),
    });
  }

  let filteredSummary = summaryData;
  if (selectedPerson !== 'All') {
    filteredSummary = summaryData.filter(s => s.name === selectedPerson);
  }

  const totalSalesAll = filteredSummary.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalInvoicesAll = filteredSummary.reduce((sum, s) => sum + s.invoiceCount, 0);

  const columns = [
    { 
      title: 'Sales Person', 
      dataIndex: 'name', 
      key: 'name',
      render: (v: string) => <Text strong><UserOutlined style={{ marginRight: 8 }} />{v}</Text> 
    },
    { 
      title: 'Invoices', 
      dataIndex: 'invoiceCount', 
      key: 'invoiceCount',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString()
    },
    { 
      title: 'Qty Sold', 
      dataIndex: 'totalQty', 
      key: 'totalQty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString()
    },
    { 
      title: 'Tax Collected', 
      dataIndex: 'totalGst', 
      key: 'totalGst',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString()
    },
    { 
      title: 'Total Revenue', 
      dataIndex: 'totalAmount', 
      key: 'totalAmount',
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1890ff' }}>{v.toLocaleString()}</Text>
    },
    {
      title: '% of Total',
      key: 'percent',
      align: 'right' as const,
      render: (_: any, r: any) => {
        const pct = (r.totalAmount / (totalSalesAll || 1)) * 100;
        return `${pct.toFixed(1)}%`;
      }
    }
  ];

  const handleExportExcel = () => {
     const companyName = currentCompany?.name || 'Company';
     const periodLabel = `${dateRange[0]?.format('DD-MM-YYYY')} to ${dateRange[1]?.format('DD-MM-YYYY')}`;

     // Sheet 1: Summary
     const summaryWsData = [
       [{ v: companyName, s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } } }],
       [{ v: 'Sales by Sales Person Summary', s: { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center' } } }],
       [{ v: `Period: ${periodLabel}`, s: { alignment: { horizontal: 'center' } } }],
       [],
       ['Sales Person', 'Invoices', 'Qty Sold', 'Tax', 'Total Amount', '% Share'].map(h => ({ v: h, s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEEEEE' } } } })),
       ...summaryData.map(r => [
         r.name,
         r.invoiceCount,
         r.totalQty,
         r.totalGst,
         r.totalAmount,
         `${((r.totalAmount / (totalSalesAll || 1)) * 100).toFixed(1)}%`
       ]),
       [],
       ['TOTAL', '', '', summaryData.reduce((s, x) => s + x.totalGst, 0), totalSalesAll, '100%'].map(v => ({ v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'FFFFCC' } } } }))
     ];

     // Sheet 2: Details
     const detailRows = data.filter(r => selectedPerson === 'All' || (r.salesperson_name || 'Unassigned') === selectedPerson);
     const detailWsData = [
       [{ v: companyName, s: { font: { bold: true, sz: 14 } } }],
       [{ v: 'Detailed Sales Register (FBR Format)', s: { font: { bold: true, sz: 12 } } }],
       [{ v: `Filter: ${selectedPerson} | Period: ${periodLabel}` }],
       [],
       ['Date', 'Inv #', 'Customer', 'NTN', 'HS Code', 'Qty', 'Value', 'Tax', 'Total'].map(h => ({ v: h, s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEEEEE' } } } })),
       ...detailRows.map(r => [
         dayjs(r.invoice_date).format('DD-MM-YYYY'),
         r.invoice_number,
         r.customer_name,
         r.customer_ntn,
         r.hs_code,
         r.quantity,
         r.gross_amount,
         r.gst_amount,
         r.line_total
       ])
     ];

     const wb = XLSXStyle.utils.book_new();
     const ws1 = XLSXStyle.utils.aoa_to_sheet(summaryWsData);
     const ws2 = XLSXStyle.utils.aoa_to_sheet(detailWsData);
     
     XLSXStyle.utils.book_append_sheet(wb, ws1, 'Summary');
     XLSXStyle.utils.book_append_sheet(wb, ws2, 'Detailed Register');
     
     XLSXStyle.writeFile(wb, `Sales_By_Salesperson_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const handleSavePDF = async () => {
    try {
      const fileName = `Sales_By_Salesperson_${dayjs().format('YYYY-MM-DD')}.pdf`;
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
              <Title level={3} style={{ margin: 0 }}>Sales by Sales Person</Title>
            </Space>
            <Space>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Excel Export</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
              <Button type="primary" onClick={handleSavePDF}>Save as PDF</Button>
            </Space>
          </div>

          <Card size="small">
            <Space wrap>
              <RangePicker value={dateRange} onChange={(v: any) => setDateRange(v)} format="DD-MM-YYYY" />
              <Select
                style={{ width: 200 }}
                placeholder="Filter by Sales Person"
                value={selectedPerson}
                onChange={setSelectedPerson}
                options={[
                  { label: 'All Sales Persons', value: 'All' },
                  ...salespeople.map(name => ({ label: name, value: name })),
                  ...(data.some(r => !r.salesperson_name) ? [{ label: 'Unassigned', value: 'Unassigned' }] : [])
                ]}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>Refresh Data</Button>
            </Space>
          </Card>

          <Row gutter={16}>
             <Col span={8}><Card><Statistic title="Sales Persons" value={filteredSummary.length} prefix={<UserOutlined />} /></Card></Col>
             <Col span={8}><Card><Statistic title="Total Invoices" value={totalInvoicesAll} /></Card></Col>
             <Col span={8}><Card><Statistic title="Total Revenue" value={totalSalesAll} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          </Row>
        </Space>
      </div>

      <Card title="Performance Summary" bodyStyle={{ padding: 0 }} style={{ marginBottom: 24 }}>
        <Table
          dataSource={filteredSummary}
          columns={columns}
          rowKey="name"
          loading={loading}
          pagination={false}
          size="middle"
          bordered
        />
      </Card>

    </div>
  );
};

export default SalesBySalesPersonReport;
