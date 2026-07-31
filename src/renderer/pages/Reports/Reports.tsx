import React, { useState } from 'react';
import { Card, Row, Col, Button, DatePicker, Select, Space } from 'antd';
import { FilePdfOutlined, FileExcelOutlined, PrinterOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { isPurchaseEnabled } = useApp();
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);

  const reports = [
    {
      title: 'Sales Report',
      description: 'View invoices, revenue, tax, and customer balances',
      icon: <FileTextOutlined />, // Changed from FilePdfOutlined
      type: 'sales',
      route: '/reports/sales',
      available: true,
    },
    {
      title: 'Purchase Report',
      description: 'View purchase invoices, vendor totals, and balance due',
      icon: <FileExcelOutlined />,
      type: 'purchase',
      route: '/reports/purchase',
      available: true,
    },
    {
      title: 'Stock Report',
      description: 'Stock levels, location, valuation, and low-stock alerts',
      icon: <FileTextOutlined />, // Changed from FilePdfOutlined
      type: 'inventory',
      route: '/reports/inventory',
      available: true,
    },
    {
      title: 'Customer Outstanding',
      description: 'Customer list with total outstanding due',
      icon: <FileExcelOutlined />,
      type: 'customer_outstanding',
      route: '/reports/customer-outstanding',
      available: true,
    },
    {
      title: 'Profit & Loss',
      description: 'Income statement and financial performance',
      icon: <FilePdfOutlined />,
      type: 'pl',
      route: '/reports/pl',
      available: true,
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and equity statement',
      icon: <FilePdfOutlined />,
      type: 'balance',
      route: '/reports/balance',
      available: true,
    },
    {
      title: 'Customer Ledger',
      description: 'Individual customer ledger — invoices, payments, and running balance',
      icon: <FileExcelOutlined />,
      type: 'customer_ledger',
      route: '/reports/customer-ledger',
      available: true,
    },
    {
      title: 'Vendor Ledger',
      description: 'Individual vendor ledger — purchases, payments, and running balance',
      icon: <FileExcelOutlined />,
      type: 'vendor_ledger',
      route: '/reports/vendor-ledger',
      available: true,
    },
    {
      title: 'Expense Report',
      description: 'Expense analysis by category, vendor, and status',
      icon: <FilePdfOutlined />,
      type: 'expenses',
      route: '/reports/expenses',
      available: true,
    },
    {
      title: 'Tax Deduction Report',
      description: 'GST/Sales Tax collected per invoice — taxable amount, rate, and tax total',
      icon: <FilePdfOutlined />,
      type: 'tax',
      route: '/reports/tax',
      available: true,
    },
    {
      title: 'Recovery Report',
      description: 'Accounts receivable with aging buckets — current, 1–30, 31–60, 61–90, 90+ days',
      icon: <FilePdfOutlined />,
      type: 'aging',
      route: '/reports/recovery',
      available: true,
    },
    {
      title: 'Stock Movement',
      description: 'Track item inbound/outbound history — purchase vs delivery challans',
      icon: <PrinterOutlined />,
      type: 'stock_movement',
      route: '/reports/stock-movement',
      available: true,
    },
    {
      title: 'Sales by Item Details',
      description: 'Per-item sales breakdown with quantities, rates, and individual line totals',
      icon: <FileTextOutlined />,
      type: 'sales_by_item',
      route: '/reports/sales-by-item',
      available: true,
    },
    {
      title: 'Sales by Sales Person',
      description: 'Analyze salesperson performance — total revenue, invoice counts, and item breakdown',
      icon: <TeamOutlined />,
      type: 'sales_by_salesperson',
      route: '/reports/sales-by-salesperson',
      available: true,
    },
  ].filter(r => {
    if (!isPurchaseEnabled && (r.type === 'purchase' || r.type === 'vendor_ledger')) return false;
    return true;
  });

  const handleGenerateReport = (report: any) => {
    if (report.route) {
      navigate(report.route);
    }
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
              hoverable={report.available}
              style={{ opacity: report.available ? 1 : 0.55 }}
              onClick={() => report.available && handleGenerateReport(report)}
              actions={
                report.available
                  ? [
                      <Button
                        type="link"
                        icon={<PrinterOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleGenerateReport(report); }}
                      >
                        Open
                      </Button>,
                    ]
                  : [
                      <span style={{ color: '#aaa', fontSize: 12 }}>Coming Soon</span>,
                    ]
              }
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
