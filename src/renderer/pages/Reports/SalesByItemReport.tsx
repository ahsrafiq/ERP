import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Card, DatePicker, Select, Button, Space,
  Typography, notification, message, Input, Statistic, Row, Col, Divider
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileTextOutlined,
  FileExcelOutlined, SearchOutlined, BarChartOutlined, DollarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const SalesByItemReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');

  useEffect(() => {
    if (currentCompany) {
      loadCustomers();
      loadData();
    }
  }, [currentCompany]);

  const loadCustomers = async () => {
    try {
      const res = await (window as any).electronAPI.db.customers.getAll(currentCompany!.id);
      if (res.success) setCustomers(res.data || []);
    } catch { /* ignore */ }
  };

  const loadData = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate = dateRange[1].format('YYYY-MM-DD');
      if (selectedCustomer) filters.customerId = selectedCustomer;
      if (itemName) filters.itemName = itemName;
      if (brand) filters.brand = brand;

      const res = await (window as any).electronAPI.db.salesInvoices.getSalesByItem(currentCompany.id, filters);
      if (res.success) {
        setData(res.data || []);
      } else {
        notification.error({ message: 'Error', description: res.error || 'Failed to load report data' });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load report data' });
    } finally {
      setLoading(false);
    }
  };

  const totalQty = data.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalAmount = data.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
  const totalGst = data.reduce((sum, item) => sum + (Number(item.gst_amount) || 0), 0);
  const totalExcl = totalAmount - totalGst;

  const columns = [
    { title: 'Date', dataIndex: 'invoice_date', render: (d: string) => d ? dayjs(d).format('DD-MM-YYYY') : '-' },
    { title: 'Invoice #', dataIndex: 'invoice_number', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Customer', dataIndex: 'customer_name' },
    { title: 'Item Name', dataIndex: 'item_name', render: (v: string, r: any) => v || r.description || '-' },
    { title: 'Brand', dataIndex: 'brand' },
    { title: 'Qty', dataIndex: 'quantity', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Rate', dataIndex: 'unit_price', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Tax', dataIndex: 'gst_amount', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Total', dataIndex: 'line_total', align: 'right' as const, render: (v: number) => <Text strong>{Number(v || 0).toLocaleString()}</Text> },
  ];

  const handleExportExcel = () => {
     const companyName = currentCompany?.name || 'Company';
     const periodLabel = `${dateRange[0]?.format('DD-MM-YYYY')} to ${dateRange[1]?.format('DD-MM-YYYY')}`;

     const wsData = [
       [{ v: companyName, s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } } }],
       [{ v: 'Sales by Item Details Report', s: { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center' } } }],
       [{ v: `Period: ${periodLabel}`, s: { alignment: { horizontal: 'center' } } }],
       [],
       ['Date', 'Invoice #', 'Customer', 'Item Name', 'Brand', 'Qty', 'Rate', 'GST', 'Total'].map(h => ({ v: h, s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEEEEE' } }, border: { bottom: { style: 'thin' } } } })),
       ...data.map(r => [
         dayjs(r.invoice_date).format('DD-MM-YYYY'),
         r.invoice_number,
         r.customer_name,
         r.item_name || r.description,
         r.brand,
         r.quantity,
         r.unit_price,
         r.gst_amount,
         r.line_total
       ]),
       [],
       ['', '', '', '', 'TOTAL', totalQty, '', totalGst, totalAmount].map((v, i) => ({ v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'FFFFCC' } } } }))
     ];

     const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
     ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
     ];
     const wb = XLSXStyle.utils.book_new();
     XLSXStyle.utils.book_append_sheet(wb, ws, 'SalesByItem');
     XLSXStyle.writeFile(wb, `Sales_By_Item_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const handleSavePDF = async () => {
    const fileName = `Sales_By_Item_${dayjs().format('YYYY-MM-DD')}.pdf`;
    const pathResult = await (window as any).electronAPI.db.files.getSavePath(fileName);
    if (!pathResult.success) return;
    
    // Simple way to trigger capture of the hidden container
    const pc = document.getElementById('report-pdf-container');
    if (pc) pc.style.display = 'block';
    const res = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
    if (pc) pc.style.display = 'none';

    if (res.success) message.success('PDF saved successfully');
    else message.error('Failed to save PDF');
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="no-print" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
              <Title level={3} style={{ margin: 0 }}>Sales by Item Details</Title>
            </Space>
            <Space>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Excel</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
              <Button type="primary" onClick={handleSavePDF}>Save as PDF</Button>
            </Space>
          </div>

          <Card size="small">
            <Space wrap>
              <RangePicker value={dateRange} onChange={(v: any) => setDateRange(v)} format="DD-MM-YYYY" />
              <Select
                placeholder="All Customers"
                style={{ width: 200 }}
                allowClear
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                options={customers.map(c => ({ label: c.name, value: c.id }))}
                showSearch
                optionFilterProp="label"
              />
              <Input placeholder="Item Name" value={itemName} onChange={e => setItemName(e.target.value)} style={{ width: 150 }} />
              <Input placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} style={{ width: 120 }} />
              <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>Search</Button>
            </Space>
          </Card>

          <Row gutter={16}>
             <Col span={6}><Card><Statistic title="Total Quantity" value={totalQty} prefix={<FileTextOutlined />} /></Card></Col>
             <Col span={6}><Card><Statistic title="Amount (Excl Tax)" value={totalExcl} precision={2} /></Card></Col>
             <Col span={6}><Card><Statistic title="Total Tax" value={totalGst} precision={2} /></Card></Col>
             <Col span={6}><Card><Statistic title="Grand Total" value={totalAmount} precision={2} prefix={<DollarOutlined />} /></Card></Col>
          </Row>
        </Space>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="line_id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        summary={() => (
           <Table.Summary fixed>
             <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
               <Table.Summary.Cell index={0} colSpan={5} align="right">TOTAL</Table.Summary.Cell>
               <Table.Summary.Cell index={1} align="right">{totalQty.toLocaleString()}</Table.Summary.Cell>
               <Table.Summary.Cell index={2} />
               <Table.Summary.Cell index={3} align="right">{totalGst.toLocaleString()}</Table.Summary.Cell>
               <Table.Summary.Cell index={4} align="right">{totalAmount.toLocaleString()}</Table.Summary.Cell>
             </Table.Summary.Row>
           </Table.Summary>
        )}
      />

      <div id="report-pdf-container" style={{ display: 'none' }}>
         <ReportTablePdfDocument
            reportTitle="Sales by Item Details Report"
            companyName={currentCompany?.name || ''}
            periodLabel={`Period: ${dateRange[0]?.format('DD-MM-YYYY')} - ${dateRange[1]?.format('DD-MM-YYYY')}`}
            columns={[
              { title: 'Date', dataIndex: 'invoice_date', render: (v:any) => dayjs(v).format('DD-MM-YYYY') },
              { title: 'Invoice #', dataIndex: 'invoice_number' },
              { title: 'Customer', dataIndex: 'customer_name' },
              { title: 'Item', dataIndex: 'item_name', render: (v:any, r:any) => v || r.description },
              { title: 'Qty', dataIndex: 'quantity', align: 'right' as const },
              { title: 'Total', dataIndex: 'line_total', align: 'right' as const, render: (v:any) => Number(v).toLocaleString() }
            ]}
            data={data}
            summaryRow={
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{totalQty}</td>
                <td style={{ textAlign: 'right' }}>{totalAmount.toLocaleString()}</td>
              </tr>
            }
         />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .ant-table-summary { display: table-footer-group !important; }
        }
      `}</style>
    </div>
  );
};

export default SalesByItemReport;
