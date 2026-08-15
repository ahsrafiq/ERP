import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Select, Button, Space, Typography, notification, message,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';
import { ReportTablePdfDocument } from '../../components/ReportPdf/ReportTablePdfDocument';

const { Title, Text } = Typography;
const { Option } = Select;

const CustomerHistoryReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      setLoading(true);
      setSelectedCustomerId(null);
      setData([]);
      setCustomers([]);

      (window as any).electronAPI.db.customers.getAll(currentCompany.id)
        .then((res: any) => {
          if (res.success) setCustomers(res.data || []);
        })
        .finally(() => setLoading(false));
    }
  }, [currentCompany]);

  useEffect(() => {
    if (currentCompany) {
      loadReportData();
    }
  }, [selectedCustomerId, currentCompany]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedCustomerId) filters.customerId = selectedCustomerId;

      const res = await (window as any).electronAPI.db.reports.getCustomerHistory(currentCompany!.id, filters);
      if (res && res.success) {
        setData(res.data || []);
      } else {
        notification.error({ message: 'Error loading customer history' });
      }
    } catch (e) {
      console.error(e);
      notification.error({ message: 'Error loading customer history' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () =>
    data.reduce(
      (acc, row) => ({
        business_done: acc.business_done + (row.business_done || 0),
        payment_recovered: acc.payment_recovered + (row.payment_recovered || 0),
      }),
      { business_done: 0, payment_recovered: 0 }
    );

  const getFileBaseName = () => {
    const custName = selectedCustomerId
      ? (customers.find((c) => c.id === selectedCustomerId)?.name || 'Customer').replace(/\s+/g, '_')
      : 'All_Customers';
    const dateStr = dayjs().format('YYYYMMDD');
    return `CustomerHistory_${custName}_${dateStr}`;
  };

  const handlePrint = async () => {
    try {
      const fileName = `${getFileBaseName()}.pdf`;
      const pathResult = await (window as any).electronAPI.db.files.getSavePath(fileName);
      if (!pathResult || !pathResult.success) return;

      // Use body class so CSS @media print can show the print container
      document.body.classList.add('capturing-pdf');
      const printContainer = document.getElementById('print-container');
      if (printContainer) printContainer.style.display = 'block';

      // Wait for layout to paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);

      if (result.success) {
        message.success(`PDF saved to: ${result.filePath}`);
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to save PDF', duration: 0 });
      }
    } catch (err) {
      console.error(err);
      notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
    } finally {
      document.body.classList.remove('capturing-pdf');
      const printContainer = document.getElementById('print-container');
      if (printContainer) printContainer.style.display = 'none';
    }
  };

  const handleExportExcel = async () => {
    try {
      const fileName = `${getFileBaseName()}.xlsx`;
      const pathResult = await (window as any).electronAPI.db.files.getSavePath(fileName);
      if (!pathResult || !pathResult.success) return;

      const wb = XLSXStyle.utils.book_new();
      const wsData: any[] = [];
      const totals = calculateTotals();
      const custName = selectedCustomerId
        ? customers.find(c => c.id === selectedCustomerId)?.name || 'Unknown'
        : 'All Customers';
      const dateStr = new Date().toLocaleDateString('en-GB');

      const thin = { top: { style: 'thin', color: { rgb: 'AAAAAA' } }, bottom: { style: 'thin', color: { rgb: 'AAAAAA' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } };
      const sTitle = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
      const sSub   = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
      const sMeta  = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
      const sHdr   = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2F5496' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thin };
      const sHdrR  = { ...sHdr, alignment: { horizontal: 'right', vertical: 'center' } };
      const sData  = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thin };
      const sDataR = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };
      const sTot   = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thin };

      const c = (v: any, s: any = {}) => ({ v, s });

      wsData.push([c(currentCompany?.name || 'Company', sTitle)]);
      wsData.push([c('Customer History Report', sSub)]);
      wsData.push([c(`Customer: ${custName}  |  Generated: ${dateStr}`, sMeta)]);
      wsData.push([]);

      wsData.push([
        c('Month', sHdr),
        c('Customer', sHdr),
        c('Business Done (Rs.)', sHdrR),
        c('Payment Recovered (Rs.)', sHdrR),
      ]);

      data.forEach(row => {
        wsData.push([
          c(dayjs(row.month).format('MMMM YYYY'), sData),
          c(row.customer_name || '-', sData),
          c(row.business_done || 0, { ...sDataR, t: 'n', numFmt: '#,##0.00' }),
          c(row.payment_recovered || 0, { ...sDataR, t: 'n', numFmt: '#,##0.00' }),
        ]);
      });

      if (selectedCustomerId) {
        wsData.push([
          c('Grand Total', sTot),
          c('', sTot),
          c(totals.business_done, { ...sTot, t: 'n', numFmt: '#,##0.00' }),
          c(totals.payment_recovered, { ...sTot, t: 'n', numFmt: '#,##0.00' }),
        ]);
      }

      const ws: any = XLSXStyle.utils.aoa_to_sheet(wsData);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      ];
      ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 22 }, { wch: 22 }];
      ws['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

      XLSXStyle.utils.book_append_sheet(wb, ws, 'Customer History');

      const base64Data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'base64' });
      const saveRes = await (window as any).electronAPI.db.files.saveToPath(pathResult.filePath, base64Data);

      if (saveRes && saveRes.success) {
        message.success(`Excel saved to: ${saveRes.filePath}`);
      } else {
        notification.error({ message: 'Error', description: saveRes?.error || 'Failed to save Excel file' });
      }
    } catch (error) {
      console.error('Export error:', error);
      notification.error({ message: 'Error', description: 'Failed to export Excel' });
    }
  };

  const columns = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (val: string) => <Text strong>{dayjs(val).format('MMMM YYYY')}</Text>,
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (val: string) => val || '-',
    },
    {
      title: 'Business Done (Rs.)',
      dataIndex: 'business_done',
      key: 'business_done',
      align: 'right' as const,
      render: (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: 'Payment Recovered (Rs.)',
      dataIndex: 'payment_recovered',
      key: 'payment_recovered',
      align: 'right' as const,
      render: (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
  ];

  const totals = calculateTotals();
  const selectedCustomerName = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)?.name
    : undefined;

  const summaryRow = selectedCustomerId ? (
    <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
      <Table.Summary.Cell index={0} colSpan={2}>Grand Total</Table.Summary.Cell>
      <Table.Summary.Cell index={1} align="right">
        {totals.business_done.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={2} align="right">
        {totals.payment_recovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Table.Summary.Cell>
    </Table.Summary.Row>
  ) : undefined;

  return (
    <div>
      {/* Visible screen UI */}
      <div className="no-print" style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space align="center">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')} />
            <Title level={2} style={{ margin: 0 }}>Customer History Report</Title>
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              Export Excel
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              Print / PDF
            </Button>
          </Space>
        </div>

        <Card style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} md={8}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Customer</Text>
              <Select
                showSearch
                allowClear
                placeholder="All Customers (or search specific)"
                style={{ width: '100%' }}
                size="large"
                value={selectedCustomerId}
                onChange={(val) => setSelectedCustomerId(val ?? null)}
                optionFilterProp="children"
              >
                {customers.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={data}
            rowKey={(record) => record.month + record.customer_id}
            pagination={false}
            loading={loading}
            summary={() => summaryRow}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>

      {/* Hidden PDF print container — shown only during PDF capture */}
      <div id="print-container" style={{ display: 'none' }}>
        <ReportTablePdfDocument
          reportTitle="Customer History Report"
          companyName={currentCompany?.name || 'Company'}
          periodLabel={selectedCustomerName ? `Customer: ${selectedCustomerName}` : 'All Customers'}
          columns={[
            { title: 'Month', dataIndex: 'month', render: (val: string) => dayjs(val).format('MMMM YYYY') },
            { title: 'Customer', dataIndex: 'customer_name', render: (val: string) => val || '-' },
            { title: 'Business Done (Rs.)', dataIndex: 'business_done', align: 'right', render: (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { title: 'Payment Recovered (Rs.)', dataIndex: 'payment_recovered', align: 'right', render: (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
          ]}
          data={data}
          summaryRow={
            selectedCustomerId ? (
              <tr>
                <td colSpan={2} style={{ textAlign: 'left', fontWeight: 'bold' }}>Grand Total</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {totals.business_done.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {totals.payment_recovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ) : undefined
          }
        />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          #print-container { display: block !important; }
        }
        @media screen {
          #print-container { display: none; }
        }
      `}</style>
    </div>
  );
};

export default CustomerHistoryReport;
