import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, Typography, Table } from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const { Text } = Typography;

const Dashboard: React.FC = () => {
  const { currentCompany, fiscalYear } = useApp();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<any>({});
  const [history, setHistory] = useState<any>({ sales: [], recovery: [] });

  useEffect(() => {
    if (currentCompany) {
      loadDashboardData();
    }
  }, [currentCompany, fiscalYear]);

  const loadDashboardData = async () => {
    if (!currentCompany) return;

    setLoading(true);
    try {
      // Load KPIs (Outstanding, Overdue)
      const kpiResult = await (window as any).electronAPI.db.dashboard.getKPIs(currentCompany.id, { fiscalYear });
      if (kpiResult.success) setKpis(kpiResult.data || {});

      // Load 6-month History (Sales, Recovery)
      const histResult = await (window as any).electronAPI.db.dashboard.getHistory(currentCompany.id, { fiscalYear });
      if (histResult.success) setHistory(histResult.data || { sales: [], recovery: [] });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLacs = (val: number) => {
    if (val === 0) return '0';
    const lacs = val / 100000;
    return `${val.toLocaleString()} (${lacs.toFixed(2)} Lac)`;
  };

  const salesColumns = [
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { 
      title: 'Sale Value', 
      dataIndex: 'amount', 
      key: 'amount', 
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatLacs(val)}</Text>
    },
  ];

  const recoveryColumns = [
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { 
      title: 'Recovery Value', 
      dataIndex: 'amount', 
      key: 'amount', 
      align: 'right' as const,
      render: (val: number) => <Text strong style={{ color: '#52c41a' }}>{formatLacs(val)}</Text>
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0 }}>Dashboard Overview</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          <Row gutter={[24, 24]}>
            {/* 1. Complete Outstanding */}
            <Col xs={24} md={12}>
              <Card bordered={false} className="metric-card">
                <Statistic
                  title={<Text strong style={{ fontSize: '16px' }}>Complete Outstanding</Text>}
                  value={kpis.customerOutstanding || 0}
                  prefix={<DollarOutlined />}
                  precision={0}
                  valueStyle={{ color: '#1890ff', fontSize: '32px', fontWeight: 'bold' }}
                />
                <Text type="secondary">Total receivables from all customers</Text>
              </Card>
            </Col>

            {/* 2. Overdue Outstanding */}
            <Col xs={24} md={12}>
              <Card bordered={false} className="metric-card">
                <Statistic
                  title={<Text strong style={{ fontSize: '16px' }}>Overdue Outstanding</Text>}
                  value={kpis.overdueOutstanding || 0}
                  prefix={<WarningOutlined />}
                  precision={0}
                  valueStyle={{ color: '#cf1322', fontSize: '32px', fontWeight: 'bold' }}
                />
                <Text type="secondary">Invoices past their due date</Text>
              </Card>
            </Col>

            {/* 3. Sale Report (Last 6 Months) */}
            <Col xs={24} lg={12}>
              <Card title={<Text strong>Sale Report (Last 6 Months)</Text>} bordered={false}>
                <Table 
                  dataSource={history.sales} 
                  columns={salesColumns} 
                  pagination={false} 
                  rowKey="month"
                  size="small"
                />
              </Card>
            </Col>

            {/* 4. Recovery Report (Last 6 Months) */}
            <Col xs={24} lg={12}>
              <Card title={<Text strong>Recovery Report (Last 6 Months)</Text>} bordered={false}>
                <Table 
                  dataSource={history.recovery} 
                  columns={recoveryColumns} 
                  pagination={false} 
                  rowKey="month"
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
