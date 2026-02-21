import React, { useState } from 'react';
import { Card, Row, Col, Button, DatePicker, Select, Space } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, PrinterOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports: React.FC = () => {
  const { currentCompany } = useApp();
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);

  const reports = [
    {
      title: 'Sales Report',
      description: 'View sales invoices, revenue, and customer analysis',
      icon: <FilePdfOutlined />,
      type: 'sales',
    },
    {
      title: 'Purchase Report',
      description: 'View purchase invoices and vendor analysis',
      icon: <FileExcelOutlined />,
      type: 'purchase',
    },
    {
      title: 'Inventory Report',
      description: 'Stock levels, movements, and valuation',
      icon: <FilePdfOutlined />,
      type: 'inventory',
    },
    {
      title: 'Profit & Loss',
      description: 'Income statement and financial performance',
      icon: <FilePdfOutlined />,
      type: 'pl',
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and equity statement',
      icon: <FilePdfOutlined />,
      type: 'balance',
    },
    {
      title: 'Customer Ledger',
      description: 'Customer transactions and balances',
      icon: <FileExcelOutlined />,
      type: 'customer_ledger',
    },
    {
      title: 'Vendor Ledger',
      description: 'Vendor transactions and balances',
      icon: <FileExcelOutlined />,
      type: 'vendor_ledger',
    },
    {
      title: 'Expense Report',
      description: 'Expense analysis by category',
      icon: <FilePdfOutlined />,
      type: 'expenses',
    },
    {
      title: 'Tax Report',
      description: 'Tax summary and compliance',
      icon: <FilePdfOutlined />,
      type: 'tax',
    },
    {
      title: 'Aging Report',
      description: 'Accounts receivable and payable aging',
      icon: <FilePdfOutlined />,
      type: 'aging',
    },
  ];

  const handleGenerateReport = (type: string) => {
    // Report generation logic would go here
    // For now, just show a message
    console.log(`Generating ${type} report for date range:`, dateRange);
    // In production, this would call IPC handlers to generate PDF/Excel
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1>Reports</h1>
        <Space style={{ marginTop: 16 }}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
          />
          <Select defaultValue="all" style={{ width: 150 }}>
            <Option value="all">All Companies</Option>
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {reports.map((report, index) => (
          <Col xs={24} sm={12} lg={8} key={index}>
            <Card
              hoverable
              actions={[
                <Button
                  type="link"
                  icon={<FilePdfOutlined />}
                  onClick={() => handleGenerateReport(report.type)}
                >
                  PDF
                </Button>,
                <Button
                  type="link"
                  icon={<FileExcelOutlined />}
                  onClick={() => handleGenerateReport(report.type)}
                >
                  Excel
                </Button>,
                <Button
                  type="link"
                  icon={<PrinterOutlined />}
                  onClick={() => handleGenerateReport(report.type)}
                >
                  Print
                </Button>,
              ]}
            >
              <Card.Meta
                title={report.title}
                description={report.description}
                avatar={report.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Reports;
