import React from 'react';
import { Result } from 'antd';

const Employees: React.FC = () => {
  return (
    <div>
      <h1>Employees</h1>
      <Result
        status="info"
        title="Employees Module"
        subTitle="Employee management functionality will be implemented here."
      />
    </div>
  );
};

export default Employees;
