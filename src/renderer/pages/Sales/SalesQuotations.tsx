import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, notification, Popconfirm, Row, Col, Tag, AutoComplete, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, FileTextOutlined, CheckCircleOutlined, MinusCircleOutlined, MinusSquareOutlined, LockOutlined, StopOutlined, EyeOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { filterRowsByOperationalFiscalYear } from '../../utils/fiscalYearFilter';
import PrintTemplate from '../../components/PrintTemplate';
import XLSX from 'xlsx-js-style';

const VALIDITY_STORAGE_KEY = 'erp_validity_suggestions';
const REMARKS_STORAGE_KEY = 'erp_remarks_suggestions';

const DEFAULT_REMARKS = ['Ready Stock', 'Not Available', 'Convey later'];

function loadSuggestions(key: string, defaults: string[] = []): string[] {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                return arr;
            }
        } else if (defaults.length > 0) {
            localStorage.setItem(key, JSON.stringify(defaults));
            return defaults;
        }
    } catch { /* ignore */ }
    return defaults;
}

function saveSuggestion(key: string, value: string, defaults: string[] = []) {
    if (!value?.trim()) return;
    const existing = loadSuggestions(key, defaults);
    if (!existing.includes(value.trim())) {
        const updated = [...existing, value.trim()];
        localStorage.setItem(key, JSON.stringify(updated));
    }
}

const SalesQuotations: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear, minimizeModal, globalRefreshKey } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const [quotations, setQuotations] = useState<any[]>([]);
    const quotationsRef = React.useRef<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<any>(null);
    const [defaultQuotationNumber, setDefaultQuotationNumber] = useState<string>('');
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [contentScale, setContentScale] = useState<number>(() => {
    const saved = localStorage.getItem('quotation_scale');
    return saved ? parseFloat(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem('quotation_scale', contentScale.toString());
  }, [contentScale]);
    const [printWithLetterhead, setPrintWithLetterhead] = useState(true);

    // Keep an always-fresh ref for Ctrl+P fallback selection.
    useEffect(() => {
        quotationsRef.current = quotations;
    }, [quotations]);
    const lastPrintRecordRef = React.useRef<any>(null);

    // Admin password delete
    const [deletePasswordModal, setDeletePasswordModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [adminPassword, setAdminPassword] = useState('');

    // DC from quotation - item selection
    const [dcSelectionModal, setDcSelectionModal] = useState(false);
    const [dcSourceQuotation, setDcSourceQuotation] = useState<any>(null);
    const [dcSelectedItems, setDcSelectedItems] = useState<React.Key[]>([]);
    const [dcItemQuantities, setDcItemQuantities] = useState<{ [key: number]: number }>({});
    const [dcPoNumber, setDcPoNumber] = useState('');
    const [dcForceCreate, setDcForceCreate] = useState(false);

    // Autocomplete suggestions
    const [validitySuggestions, setValiditySuggestions] = useState<string[]>([]);
    const [remarksSuggestions, setRemarksSuggestions] = useState<string[]>([]);
    const passwordInputRef = React.useRef<any>(null);

    const handleDeleteRemark = (e: React.MouseEvent, s: string) => {
        e.stopPropagation();
        e.preventDefault();
        const updated = remarksSuggestions.filter(item => item !== s);
        setRemarksSuggestions(updated);
        localStorage.setItem(REMARKS_STORAGE_KEY, JSON.stringify(updated));
        message.success('Remark suggestion deleted successfully');
    };

    const handleDeleteValidity = (e: React.MouseEvent, s: string) => {
        e.stopPropagation();
        e.preventDefault();
        const updated = validitySuggestions.filter(item => item !== s);
        setValiditySuggestions(updated);
        localStorage.setItem(VALIDITY_STORAGE_KEY, JSON.stringify(updated));
        message.success('Validity suggestion deleted successfully');
    };

    useEffect(() => {
        if (deletePasswordModal) {
            setTimeout(() => {
                passwordInputRef.current?.select();
                passwordInputRef.current?.focus();
            }, 100);
        }
    }, [deletePasswordModal]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                // If preview is open, print the preview
                if (isPreviewVisible) {
                    actualPrint();
                    return;
                }
                // Otherwise, open the preview for the last clicked "Print"
                // (or fall back to the first available quotation on this page).
                const record = lastPrintRecordRef.current ?? quotationsRef.current?.[0];
                if (record) handlePrint(record);
                else message.warning('No quotations available to print.');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPreviewVisible]);

    const watchedCustomerId = Form.useWatch('customer_id', form);

    // Section permissions (Sales)
    const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
    const sectionPerms = (user as any)?.section_permissions || {};
    const salesPerm: string = isAdminUser ? 'all' : (sectionPerms.sales || 'read');
    const canCreateOrEdit = isAdminUser || salesPerm === 'write' || salesPerm === 'edit' || salesPerm === 'all';
    const canEditOrDelete = isAdminUser || salesPerm === 'edit' || salesPerm === 'all';
    const isReadOnlySection = !isAdminUser && salesPerm === 'read';

    useEffect(() => {
        setValiditySuggestions(loadSuggestions(VALIDITY_STORAGE_KEY));
        setRemarksSuggestions(loadSuggestions(REMARKS_STORAGE_KEY, DEFAULT_REMARKS));
    }, []);

    useEffect(() => {
        if (currentCompany) {
            if (location.pathname === '/sales/quotations') {
                loadQuotations();
                loadCustomers();
                loadItems();
                loadBrands();
            } else if (quotations.length === 0) {
                loadQuotations();
                loadCustomers();
                loadItems();
                loadBrands();
            }
        }
    }, [currentCompany, location.pathname, fiscalYear, globalRefreshKey]);

    useEffect(() => {
        if (location.state?.editQuotationId && customers.length > 0) {
            handleEdit({ id: location.state.editQuotationId });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, customers]);

    useEffect(() => {
        if (!modalVisible) return;

        if (watchedCustomerId == null || watchedCustomerId === '') {
            form.setFieldsValue({ terms_and_conditions: [] });
            return;
        }

        const id = Number(watchedCustomerId);
        if (!id) return;

        const parseTerms = (raw: any): string[] => {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
                try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch { /* legacy */ }
                return raw.trim() ? [raw] : [];
            }
            return [];
        };

        const fromList = customers.find((c: any) => c.id === id);
        if (fromList && fromList.terms_and_conditions != null) {
            form.setFieldsValue({ terms_and_conditions: parseTerms(fromList.terms_and_conditions) });
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await (window as any).electronAPI.db.customers.getById(id);
                if (cancelled) return;
                if (result?.success && result?.data) {
                    form.setFieldsValue({ terms_and_conditions: parseTerms(result.data.terms_and_conditions) });
                }
            } catch (_) { }
        })();
        return () => { cancelled = true; };
    }, [modalVisible, watchedCustomerId, form]);

    const loadQuotations = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.getAll(currentCompany.id);
            if (result.success) {
                setQuotations(filterRowsByOperationalFiscalYear(result.data || [], fiscalYear));
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to load quotations', duration: 0 });
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
        if (result.success) setCustomers(result.data || []);
    };

    const loadItems = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (result.success) setItems(result.data || []);
    };

    const loadBrands = async () => {
        const result = await (window as any).electronAPI.db.brands.getAll();
        if (result.success) setBrands(result.data || []);
    };

    const handlePrint = async (record: any) => {
        try {
            lastPrintRecordRef.current = record;
            const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
            if (result.success && result.data) {
                setPrintData(result.data);
                setIsPreviewVisible(true);
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to prepare print', duration: 0 });
        }
    };

  const actualPrint = () => {
  // Apply capturing class to hide UI and render only print container
  const body = document.body;
  body.classList.add('capturing-pdf');
  // Force reflow to ensure styles are applied
  void body.offsetHeight;
  setTimeout(async () => {
    try {
      // Use IPC print which returns a promise that resolves when dialog closes
      await (window as any).electronAPI.db.files.print();
    } catch (err) {
      console.error('IPC print failed, falling back to window.print():', err);
      window.print();
    } finally {
      // Clean up class after print dialog is closed
      body.classList.remove('capturing-pdf');
    }
  }, 300);
};

    const handleSavePDF = async () => {
        try {
            const customerName = printData?.customer_name ? printData.customer_name.trim() : 'Customer';
            const billNumber = printData?.quotation_number ? printData.quotation_number.trim() : 'Quotation';
            const cleanCustomer = customerName.replace(/[\\/:*?"<>|]/g, '_');
            const cleanBill = billNumber.replace(/[\\/:*?"<>|]/g, '_');
            const defaultName = `BILL_${cleanCustomer}_${cleanBill}.pdf`;

            const pathResult = await (window as any).electronAPI.db.files.getSavePath(defaultName);
            if (!pathResult.success) return;
            document.body.classList.add('capturing-pdf');
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
            if (result.success) {
                message.success(`Saved to: ${result.filePath}`);
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to save PDF', duration: 0 });
            }
        } catch {
            notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
        } finally {
            document.body.classList.remove('capturing-pdf');
        }
    };

    const loadNextQuotationNumber = async () => {
        if (!currentCompany) return;
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.getNextNumber(currentCompany.id, fiscalYear);
            if (result.success) {
                setDefaultQuotationNumber(result.data);
                form.setFieldsValue({
                    quotation_number: result.data,
                });
            }
        } catch (error) {
            console.error('Failed to load next quotation number', error);
        }
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
        if (result.success) {
            setEditingQuotation(result.data);
            let terms: string[] = [];
            const raw = result.data.terms_and_conditions;
            if (raw) { try { const arr = JSON.parse(raw); terms = Array.isArray(arr) ? arr : [raw]; } catch { terms = [raw]; } }
            form.setFieldsValue({
                ...result.data,
                quotation_date: dayjs(result.data.quotation_date),
                terms_and_conditions: terms,
            });
            setModalVisible(true);
        } else {
            notification.error({ message: 'Error', description: 'Failed to fetch quotation details', duration: 0 });
        }
    };

    const handleCreateChallan = async (record: any) => {
        const hasExistingDc = (record.delivery_challan_count ?? 0) > 0;

        const proceed = async () => {
            try {
                const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
                if (result.success && result.data && result.data.items?.length) {
                    setDcSourceQuotation(result.data);
                    setDcSelectedItems(result.data.items.map((_: any, i: number) => i));
                    setDcForceCreate(hasExistingDc);
                    const initialQuants: any = {};
                    result.data.items.forEach((it: any, i: number) => { initialQuants[i] = it.quantity; });
                    setDcItemQuantities(initialQuants);
                    setDcPoNumber('');
                    setDcSelectionModal(true);
                } else {
                    notification.error({ message: 'Error', description: 'Quotation has no items', duration: 0 });
                }
            } catch {
                notification.error({ message: 'Error', description: 'Failed to load quotation', duration: 0 });
            }
        };

        if (hasExistingDc) {
            Modal.confirm({
                title: 'Delivery challan already exists',
                content: 'A delivery challan already exists for this quotation. Do you want to create another one as a duplicate?',
                okText: 'Create Duplicate DC',
                cancelText: 'Cancel',
                onOk: proceed,
            });
        } else {
            proceed();
        }
    };

    const confirmCreateDC = async (force: boolean = false) => {
        if (!dcSourceQuotation || dcSelectedItems.length === 0) {
            message.warning('Select at least one item');
            return;
        }
        try {
            const selectedItems = dcSelectedItems.map(key => {
                const i = Number(key);
                return {
                    ...dcSourceQuotation.items[i],
                    quantity: dcItemQuantities[i] || dcSourceQuotation.items[i].quantity
                };
            });
            // Ensure all data is plain and serializable for IPC
            const plainQuotationId = JSON.parse(JSON.stringify(dcSourceQuotation.id));
            const plainUserId = user?.id ? JSON.parse(JSON.stringify(user.id)) : undefined;
            const plainItems = JSON.parse(JSON.stringify(selectedItems.map((it: any) => ({
                item_id: it.item_id,
                quantity: it.quantity,
                description: it.description,
                unit_price: it.unit_price,
                brand_id: it.brand_id,
            }))));
            const plainPo = dcPoNumber?.trim() || '';
            const plainFy = fiscalYear ? JSON.parse(JSON.stringify(fiscalYear)) : undefined;
            const plainForce = Boolean(force || dcForceCreate);

            const result = await (window as any).electronAPI.db.deliveryChallans.createFromQuotation(
                plainQuotationId,
                plainUserId,
                plainItems,
                plainPo,
                plainFy,
                plainForce
            );
            if (result.success && result.data) {
                message.success(`Delivery Challan ${result.data.challan_number} created`);
                setDcSelectionModal(false);
                setDcSourceQuotation(null);
                setDcForceCreate(false);
                setDcPoNumber('');
                setDcItemQuantities({});
                navigate('/sales/delivery-challans');
            } else if (result.error === 'ALREADY_EXISTS') {
                Modal.confirm({
                    title: 'Delivery Challan already exists',
                    content: `A delivery challan (${result.existingNumber}) already exists for this quotation. Do you want to create another one?`,
                    okText: 'Yes, create duplicate',
                    cancelText: 'Cancel',
                    onOk: () => confirmCreateDC(true),
                });
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to create delivery challan', duration: 0 });
                // If it's a conflict, refresh data to show current status
                if (result.code === 'CONFLICT' || (result.error && result.error.includes('already created'))) {
                    loadQuotations();
                }
            }
        } catch (error: any) {
            notification.error({ message: 'Error', description: error.message || 'Failed to create delivery challan', duration: 0 });
            if (error.message && error.message.includes('already created')) {
                loadQuotations();
            }
        }
    };

    const handleRequestDelete = (id: number) => {
        setPendingDeleteId(id);
        setAdminPassword('');
        setDeletePasswordModal(true);
    };

    const handleConfirmDelete = async () => {
        const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
        if (!verify.success || !verify.data) {
            notification.error({ message: 'Error', description: 'Incorrect admin password', duration: 0 });
            setAdminPassword('');
            return;
        }
        if (pendingDeleteId == null) return;
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.delete(pendingDeleteId);
            if (result.success) {
                message.success('Quotation deleted');
                loadQuotations();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to delete', duration: 0 });
            }
        } catch (error: any) {
            const msg = error?.message || 'Failed to delete';
            notification.error({ message: 'Error', description: msg, duration: 0 });
        } finally {
            setDeletePasswordModal(false);
            setPendingDeleteId(null);
            setAdminPassword('');
        }
    };

    const handleDisable = async (id: number) => {
        try {
            // Fetch the full quotation first, then update with status changed
            const fetched = await (window as any).electronAPI.db.salesQuotations.getById(id);
            if (!fetched.success || !fetched.data) {
                notification.error({ message: 'Error', description: 'Failed to load quotation', duration: 0 });
                return;
            }
            const data = fetched.data;
            const result = await (window as any).electronAPI.db.salesQuotations.update(id, {
                ...data,
                quotation_number: data.quotation_number,
                status: 'cancelled',
            });
            if (result.success) {
                message.success('Quotation disabled');
                loadQuotations();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to disable', duration: 0 });
            }
        } catch {
            notification.error({ message: 'Error', description: 'Failed to disable', duration: 0 });
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;
        try {
            // Save validity suggestion
            if (values.quotation_validity?.trim()) {
                saveSuggestion(VALIDITY_STORAGE_KEY, values.quotation_validity);
                setValiditySuggestions(loadSuggestions(VALIDITY_STORAGE_KEY));
            }

            // Save any new remarks suggestions
            values.items?.forEach((item: any) => {
                if (item.availability?.trim()) {
                    saveSuggestion(REMARKS_STORAGE_KEY, item.availability, DEFAULT_REMARKS);
                }
            });
            setRemarksSuggestions(loadSuggestions(REMARKS_STORAGE_KEY, DEFAULT_REMARKS));

            const quotationData = {
                ...values,
                company_id: currentCompany.id,
                quotation_number: values.quotation_number?.trim?.() || undefined,
                fiscal_year: fiscalYear,
                quotation_date: values.quotation_date.format('YYYY-MM-DD'),
                expiry_date: values.quotation_date && values.quotation_validity
                    ? computeExpiryDate(values.quotation_date, values.quotation_validity)
                    : undefined,
                created_by: user?.id,
                terms_and_conditions: JSON.stringify((values.terms_and_conditions || []).filter((t: string) => t?.trim())),
                pr_number: values.pr_number || null,
                isDefaultNumber: !editingQuotation && values.quotation_number === defaultQuotationNumber,
            };

            delete quotationData.payment_terms;

            let subtotal = 0;
            quotationData.items?.forEach((item: any) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                item.tax_rate = 0;
                item.tax_amount = 0;
                item.line_total = lineTotal;
                subtotal += lineTotal;
            });
            quotationData.subtotal = subtotal;
            quotationData.tax_amount = 0;
            quotationData.total_amount = subtotal;

            if (editingQuotation) {
                const result = await (window as any).electronAPI.db.salesQuotations.update(editingQuotation.id, quotationData);
                if (result.success) {
                    message.success('Quotation updated successfully');
                    setModalVisible(false);
                    setEditingQuotation(null);
                    loadQuotations();
                } else {
                    notification.error({ message: 'Error', description: result.error || 'Failed to update quotation', duration: 0 });
                }
            } else {
                const result = await (window as any).electronAPI.db.salesQuotations.create(quotationData);
                if (result.success) {
                    message.success(`Quotation ${result.data?.quotation_number || ''} created successfully`);
                    setModalVisible(false);
                    setEditingQuotation(null);
                    loadQuotations();
                } else {
                    notification.error({ message: 'Error', description: result.error || 'Failed to create quotation', duration: 0 });
                }
            }
        } catch (error: any) {
            console.error('Save error:', error);
            notification.error({ message: 'Error', description: error.message || 'Operation failed', duration: 0 });
        }
    };

    const computeExpiryDate = (quoDate: any, validity: string): string | undefined => {
        if (!quoDate || !validity) return undefined;
        const match = validity.match(/^(\d+)\s*days?$/i);
        if (match) {
            return dayjs(quoDate).add(Number(match[1]), 'day').format('YYYY-MM-DD');
        }
        return undefined;
    };

    const getItemsForBrand = (brandId: number | undefined) => {
        if (!brandId) return items;
        return items.filter(i => i.brand_id === brandId);
    };

    const columns = [
        {
            title: 'Quotation #',
            dataIndex: 'quotation_number',
            key: 'quotation_number',
        },
        {
            title: 'PR #',
            dataIndex: 'pr_number',
            key: 'pr_number',
            render: (v: any) => v || '—',
        },
        { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
        { title: 'Date', dataIndex: 'quotation_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        {
            title: 'Total Amount',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount: number) => amount ? amount.toFixed(2) : '0.00',
        },
        {
            title: 'DC',
            key: 'dc',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: any) => {
                const hasDc = (record.delivery_challan_count ?? 0) > 0;
                return hasDc ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>DC made</Tag>
                ) : (
                    <Tag color="default" icon={<MinusCircleOutlined />}>No DC</Tag>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => {
                const isDisabled = record.status === 'cancelled';
                if (isDisabled) {
                    return <Tag color="red">Disabled</Tag>;
                }
                if (isReadOnlySection) {
                    // Read-only: only allow viewing/printing
                    return (
                        <Space>
                            <Button icon={<EyeOutlined />} onClick={() => handlePrint(record)} title="View Quotation" />
                        </Space>
                    );
                }
                return (
                    <Space>
                        <Button icon={<FileTextOutlined />} onClick={() => handleCreateChallan(record)} title="Create Delivery Challan" />
                        <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} title="Print" />
                        {canCreateOrEdit && (
                            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit" />
                        )}
                        {canEditOrDelete && (
                            <>
                                <Popconfirm title="Are you sure you want to disable this quotation? This cannot be undone." onConfirm={() => handleDisable(record.id)} okText="Yes, Disable" cancelText="Cancel">
                                    <Button icon={<StopOutlined />} title="Disable" />
                                </Popconfirm>
                                <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} title="Delete (Admin)" />
                            </>
                        )}
                    </Space>
                );
            },
        },
    ];

    const [searchQuery, setSearchQuery] = useState('');

    const filteredQuotations = quotations.filter(q =>
        (q.quotation_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleExportExcelSingle = () => {
        if (!printData) return;
        
        const company = (companies || []).find((c: any) => c.id === printData.company_id) || currentCompany;

        const wb = XLSX.utils.book_new();
        
        // Define styles
        const titleStyle = { font: { bold: true, size: 16 } };
        const labelStyle = { font: { bold: true } };
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "333333" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
            }
        };
        const itemStyle = {
            alignment: { vertical: "center" },
            border: {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" }
            }
        };
        const numberStyle = { ...itemStyle, alignment: { horizontal: "right", vertical: "center" } };
        const footerStyle = { font: { bold: true }, alignment: { horizontal: "right" } };

        const wsData: any[][] = [
            [{ v: 'SALES QUOTATION', s: titleStyle }],
            [],
            [{ v: 'Company:', s: labelStyle }, company?.name || ''],
            [{ v: 'Date:', s: labelStyle }, dayjs(printData.quotation_date).format('DD/MM/YYYY')],
            [{ v: 'Quotation #:', s: labelStyle }, printData.quotation_number],
            [{ v: 'PR #:', s: labelStyle }, printData.pr_number || ''],
            [{ v: 'Customer:', s: labelStyle }, printData.customer_name || ''],
            [],
            [
                { v: 'S.No', s: headerStyle },
                { v: 'Brand', s: headerStyle },
                { v: 'Item', s: headerStyle },
                { v: 'Description', s: headerStyle },
                { v: 'Qty', s: headerStyle },
                { v: 'Unit Price', s: headerStyle },
                { v: 'Total', s: headerStyle }
            ]
        ];

        // Add items
        (printData.items || []).forEach((it: any, index: number) => {
            wsData.push([
                { v: index + 1, s: itemStyle },
                { v: it.brand || '', s: itemStyle },
                { v: it.item_name || '', s: itemStyle },
                { v: it.description || '', s: itemStyle },
                { v: it.quantity || 0, s: numberStyle },
                { v: it.unit_price || 0, s: numberStyle },
                { v: (it.quantity || 0) * (it.unit_price || 0), s: numberStyle }
            ]);
        });

        // Add footer
        wsData.push([]);
        wsData.push([
            '', '', '', '', '', 
            { v: 'Total Amount:', s: footerStyle }, 
            { v: printData.total_amount || 0, s: { ...footerStyle, alignment: { horizontal: "right" } } }
        ]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = [
            { wch: 6 },  // S.No
            { wch: 15 }, // Brand
            { wch: 25 }, // Item
            { wch: 40 }, // Description
            { wch: 10 }, // Qty
            { wch: 12 }, // Unit Price
            { wch: 15 }  // Total
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
        XLSX.writeFile(wb, `${printData.quotation_number}.xlsx`);
        message.success('Exported to Excel');
    };

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h1 style={{ margin: 0 }}>Sales Quotations</h1>
                    <Input
                        placeholder="Search by quo # or customer..."
                        prefix={<SearchOutlined />}
                        style={{ width: 250 }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        allowClear
                    />
                </div>
                <Space>
                    {!isReadOnlySection && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={async () => {
                            setEditingQuotation(null);
                            form.resetFields();
                            setModalVisible(true);
                            await loadNextQuotationNumber();
                        }}>
                            New Quotation
                        </Button>
                    )}
                </Space>
            </div>

            <Table columns={columns} dataSource={filteredQuotations} loading={loading} rowKey="id" />

            <Modal
                title={editingQuotation ? 'Edit Quotation' : 'New Quotation'}
                open={modalVisible}
                onCancel={() => {
                  setModalVisible(false);
                  setEditingQuotation(null);
                  form.resetFields();
                }}
                maskClosable={true}
                onOk={() => form.submit()}
                width={1100}
                destroyOnClose
                closeIcon={
                  <Space size="middle">
                    <MinusSquareOutlined 
                      style={{ fontSize: 18, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const quoNum = form.getFieldValue('quotation_number') || 'New Quotation';
                        setModalVisible(false);
                        minimizeModal({
                          id: editingQuotation ? `quo-edit-${editingQuotation.id}` : 'quo-new',
                          title: editingQuotation ? `Edit Quotation ${quoNum}` : `New Quotation ${quoNum}`,
                          onRestore: () => {
                            setEditingQuotation(editingQuotation);
                            setModalVisible(true);
                          }
                        });
                      }}
                    />
                    <CloseOutlined style={{ fontSize: 18 }} onClick={(e) => { 
                      e.stopPropagation();
                      setModalVisible(false); 
                      setEditingQuotation(null); 
                      form.resetFields(); 
                    }} />
                  </Space>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Row gutter={16}>
                        <Col span={4}>
                            <Form.Item name="quotation_number" label="Quotation #" rules={[{ required: true, message: 'Required' }]}>
                                <Input placeholder="e.g. QUO-0001/26" />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="pr_number" label="PR #">
                                <Input placeholder="PR Number (optional)" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    filterOption={(input, option) =>
                                        String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    placeholder="Type to search customer..."
                                >
                                    {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="quotation_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="quotation_validity" label="Quotation Validity" rules={[{ required: true, message: 'Enter validity' }]}>
                                <AutoComplete
                                    options={validitySuggestions.filter(s => s).map(s => ({
                                        value: s,
                                        label: (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                <span>{s}</span>
                                                <Button 
                                                    type="text" 
                                                    danger 
                                                    size="small" 
                                                    icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                                                    onClick={(e) => handleDeleteValidity(e, s)}
                                                    style={{ height: 'auto', padding: '2px 4px' }}
                                                />
                                            </div>
                                        )
                                    }))}
                                    filterOption={(input, option) =>
                                        (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                                    }
                                    placeholder="e.g. 30 days"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.List
                        name="items"
                        rules={[{ validator: async (_, names) => { if (!names || names.length < 1) return Promise.reject(new Error('At least one item is required')); } }]}
                    >
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 140 }}>Brand</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 200 }}>Item</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 220 }}>Description</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: 70 }}>Qty</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>Price</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 150 }}>Remarks</th>
                                                <th style={{ padding: '8px', width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map(({ key, name, ...restField }) => {
                                                const currentBrandId = form.getFieldValue(['items', name, 'brand_id']);
                                                const filteredItems = getItemsForBrand(currentBrandId);
                                                return (
                                                    <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'brand_id']} style={{ marginBottom: 0 }}>
                                                                <Select
                                                                    placeholder="Brand"
                                                                    allowClear
                                                                    showSearch
                                                                    optionFilterProp="children"
                                                                    style={{ width: '100%' }}
                                                                    onChange={(brandId) => {
                                                                        const currentItems = form.getFieldValue('items') || [];
                                                                        currentItems[name] = { ...currentItems[name], brand_id: brandId, item_id: undefined, description: '', unit_price: undefined, brand: brands.find(b => b.id === brandId)?.name || '' };
                                                                        form.setFieldsValue({ items: [...currentItems] });
                                                                    }}
                                                                >
                                                                    {brands.map(b => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                                                                </Select>
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'item_id']} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                                <Select
                                                                    placeholder="Item"
                                                                    showSearch
                                                                    optionFilterProp="children"
                                                                    style={{ width: '100%' }}
                                                                    onChange={(itemId) => {
                                                                        const item = items.find(i => i.id === itemId);
                                                                        if (item) {
                                                                            const currentItems = form.getFieldValue('items') || [];
                                                                            currentItems[name] = {
                                                                                ...currentItems[name],
                                                                                item_id: itemId,
                                                                                description: item.description || '',
                                                                                brand: item.brand_name || '',
                                                                                brand_id: item.brand_id || currentItems[name]?.brand_id,
                                                                                unit_price: item.selling_price || 0,
                                                                            };
                                                                            form.setFieldsValue({ items: [...currentItems] });
                                                                        }
                                                                    }}
                                                                >
                                                                    {filteredItems.map(i => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
                                                                </Select>
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'description']} style={{ marginBottom: 0 }}>
                                                                <Input placeholder="Description" />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true, message: 'Qty' }]} style={{ marginBottom: 0 }}>
                                                                <InputNumber placeholder="Qty" min={0} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'unit_price']} rules={[{ required: true, message: 'Price' }]} style={{ marginBottom: 0 }}>
                                                                <InputNumber placeholder="Price" min={0} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'availability']} style={{ marginBottom: 0 }}>
                                                                <AutoComplete
                                                                    options={remarksSuggestions.map(s => ({
                                                                        value: s,
                                                                        label: (
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                                                <span>{s}</span>
                                                                                <Button 
                                                                                    type="text" 
                                                                                    danger 
                                                                                    size="small" 
                                                                                    icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                                                                                    onClick={(e) => handleDeleteRemark(e, s)}
                                                                                    style={{ height: 'auto', padding: '2px 4px' }}
                                                                                />
                                                                            </div>
                                                                        )
                                                                    }))}
                                                                    filterOption={(input, option) =>
                                                                        (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                    placeholder="Remarks"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', fontSize: 16 }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: 8 }}>Add Item</Button>
                                <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </>
                        )}
                    </Form.List>

                    <div style={{ marginTop: 20 }}>
                        <label style={{ fontWeight: 500 }}>Terms and Conditions</label>
                        <Form.List name="terms_and_conditions" rules={[{ validator: async (_, list) => { if (!list || list.filter((t: string) => t?.trim()).length === 0) throw new Error('Add at least one term'); } }]}>
                            {(fields, { add, remove }, { errors }) => (
                                <>
                                    {fields.map((field) => (
                                        <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, whitespace: true, message: 'Enter a term or remove this row' }]}>
                                                <Input placeholder={`Term ${field.name + 1}`} />
                                            </Form.Item>
                                            <MinusCircleOutlined onClick={() => remove(field.name)} style={{ marginTop: 8, color: '#ff4d4f' }} />
                                        </div>
                                    ))}
                                    <Button type="dashed" onClick={() => add('')} block icon={<PlusOutlined />} size="small">Add Term</Button>
                                    <Form.ErrorList errors={errors} />
                                </>
                            )}
                        </Form.List>
                    </div>
                </Form>
            </Modal>

            {/* Admin password for delete */}
            <Modal
                title="Admin Authorization Required"
                open={deletePasswordModal}
                onCancel={() => { setDeletePasswordModal(false); setPendingDeleteId(null); }}
                onOk={handleConfirmDelete}
                okText="Delete"
                okButtonProps={{ danger: true }}
            >
                <p>Enter admin password to delete this quotation:</p>
                <Input.Password
                    prefix={<LockOutlined />}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
                    ref={passwordInputRef}
                    autoFocus
                />
            </Modal>
            {/* DC item selection modal */}
            <Modal
                title="Create Delivery Challan — Select Items"
                open={dcSelectionModal}
                onCancel={() => { 
                    setDcSelectionModal(false); 
                    setDcSourceQuotation(null); 
                    setDcForceCreate(false); 
                    setDcPoNumber(''); 
                    setDcItemQuantities({}); 
                }}
                onOk={() => confirmCreateDC()}
                okText="Create DC"
                width={700}
            >
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>PO Number (Optional)</label>
                  <Input 
                    placeholder="Enter PO Number" 
                    value={dcPoNumber} 
                    onChange={e => setDcPoNumber(e.target.value)} 
                    style={{ width: '100%' }}
                  />
                </div>
                {dcSourceQuotation?.items && (
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <Table
                            dataSource={dcSourceQuotation.items.map((it: any, i: number) => ({ ...it, _idx: i }))}
                            rowKey="_idx"
                            pagination={false}
                            size="small"
                            rowSelection={{
                                selectedRowKeys: dcSelectedItems,
                                onChange: (keys) => setDcSelectedItems(keys),
                                preserveSelectedRowKeys: true,
                            }}
                            columns={[
                                { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                                { title: 'Description', dataIndex: 'description', key: 'description' },
                                {
                                    title: 'Qty',
                                    key: 'quantity',
                                    align: 'right' as const,
                                    render: (_: any, record: any) => (
                                        <InputNumber
                                            min={0}
                                            value={dcItemQuantities[record._idx] !== undefined ? dcItemQuantities[record._idx] : record.quantity}
                                            onChange={(val) => {
                                                setDcItemQuantities({ ...dcItemQuantities, [record._idx]: Number(val) || 0 });
                                            }}
                                            style={{ width: 80 }}
                                        />
                                    )
                                },
                                { title: 'Brand', dataIndex: 'brand', key: 'brand' },
                            ]}
                        />
                    </div>
                )}
            </Modal>


            <Modal
                title="Print Preview"
                open={isPreviewVisible}
                onCancel={() => {
                    setIsPreviewVisible(false);
                    setPrintData(null);
                }}
                width={900}
                maskClosable={true}
                footer={[
                    <Button key="cancel" onClick={() => setIsPreviewVisible(false)}>Close</Button>,
                    <Button key="excel" onClick={handleExportExcelSingle}>Export to Excel</Button>,
                    <Button key="pdf" icon={<PrinterOutlined />} onClick={handleSavePDF}>Save as PDF</Button>,
                    <Button key="print" type="primary" onClick={actualPrint}>Print</Button>
                ]}
                className="print-preview-modal"
                closeIcon={
                  <Space>
                    <MinusSquareOutlined
                      style={{ fontSize: 18, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const preview = printData;
                        const restoreLetterhead = printWithLetterhead;
                        const restoreScale = contentScale;
                        setIsPreviewVisible(false);
                        setPrintData(null);
                        minimizeModal({
                          id: preview?.id != null ? `print-quo-${preview.id}` : 'print-quo',
                          title: preview?.quotation_number ? `Print Quotation ${preview.quotation_number}` : 'Print Quotation',
                          returnPath: location.pathname,
                          onRestore: () => {
                            setPrintWithLetterhead(restoreLetterhead);
                            setContentScale(restoreScale);
                            setPrintData(preview);
                            setIsPreviewVisible(true);
                          },
                        });
                      }}
                    />
                    <CloseOutlined
                      style={{ fontSize: 18 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPreviewVisible(false);
                        setPrintData(null);
                      }}
                    />
                  </Space>
                }
            >
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span>Scale:</span>
                    <Select value={contentScale} onChange={v => setContentScale(v)} style={{ width: 90 }} options={[{ value: 0.5, label: '50%' }, { value: 0.6, label: '60%' }, { value: 0.7, label: '70%' }, { value: 0.8, label: '80%' }, { value: 0.9, label: '90%' }, { value: 1, label: '100%' }]} />
                    <span>Letterhead:</span>
                    <Switch
                        checked={printWithLetterhead}
                        onChange={setPrintWithLetterhead}
                        checkedChildren="With"
                        unCheckedChildren="Without"
                    />
                </div>
                <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
                    <div className="preview-page-wrapper">
                        {printData && (
                            <PrintTemplate
                                type="quotation"
                                data={printData}
                                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                                withLetterhead={printWithLetterhead}
                                contentScale={contentScale}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            <div id="print-container">
                {printData && (
                    <PrintTemplate
                        type="quotation"
                        data={printData}
                        company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                        withLetterhead={printWithLetterhead}
                        contentScale={contentScale}
                    />
                )}
            </div>

        </div>
    );
};

export default SalesQuotations;
