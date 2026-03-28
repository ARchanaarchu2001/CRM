import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteAnalystBatch as deleteAnalystBatchApi,
  fetchAnalystBatches,
  fetchLeadMetadata,
  importLeadFile,
  previewLeadFile,
} from '../api/leads.js';

const createAddedColumn = () => ({
  id: `column-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  defaultValue: '',
});

const AnalystDashboard = () => {
  const [products, setProducts] = useState(['mnp', 'p2p', 'fne', 'plus', 'general']);
  const [selectedProduct, setSelectedProduct] = useState('p2p');
  const [batches, setBatches] = useState([]);
  const [actionMessage, setActionMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadState, setUploadState] = useState({
    file: null,
    batchName: '',
    contactColumn: '',
    preview: null,
    removedColumns: [],
    addedColumns: [],
    status: '',
  });
  const [openProducts, setOpenProducts] = useState({});

  const loadMetadata = async () => {
    const data = await fetchLeadMetadata();
    setProducts(data.products || []);
    setSelectedProduct((current) => current || data.products?.[0] || 'p2p');
  };

  const loadBatches = async (product = '') => {
    const response = await fetchAnalystBatches(product ? { product } : undefined);
    setBatches(response.batches || []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadMetadata();
        await loadBatches();
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const visiblePreviewHeaders = useMemo(() => {
    const previewHeaders = uploadState.preview?.headers || [];
    const removed = new Set(uploadState.removedColumns);
    const keptHeaders = previewHeaders.filter((header) => !removed.has(header));
    const addedHeaders = uploadState.addedColumns
      .map((column) => column.name.trim())
      .filter(Boolean)
      .filter((name) => !keptHeaders.includes(name));
    return [...keptHeaders, ...addedHeaders];
  }, [uploadState.preview, uploadState.removedColumns, uploadState.addedColumns]);

  const previewRows = useMemo(() => {
    if (!uploadState.preview?.sampleRows) {
      return [];
    }

    return uploadState.preview.sampleRows.map((row) => {
      const nextRow = {};
      visiblePreviewHeaders.forEach((header) => {
        const customColumn = uploadState.addedColumns.find((column) => column.name.trim() === header);
        nextRow[header] = customColumn ? customColumn.defaultValue : row[header] || '';
      });
      return nextRow;
    });
  }, [uploadState.preview, visiblePreviewHeaders, uploadState.addedColumns]);

  const groupedBatches = useMemo(
    () =>
      products.map((product) => ({
        product,
        batches: batches.filter((batch) => batch.product === product),
      })),
    [batches, products]
  );

  useEffect(() => {
    setOpenProducts((current) =>
      products.reduce((accumulator, product) => {
        accumulator[product] = current[product] ?? true;
        return accumulator;
      }, {})
    );
  }, [products]);

  const toggleProductSection = (product) => {
    setOpenProducts((current) => ({
      ...current,
      [product]: !current[product],
    }));
  };

  const handlePreview = async (event) => {
    event.preventDefault();
    if (!uploadState.file) {
      setUploadState((current) => ({ ...current, status: 'Please choose a file first.' }));
      return;
    }

    try {
      setUploadState((current) => ({ ...current, status: 'Preparing preview...' }));
      const preview = await previewLeadFile({
        file: uploadState.file,
        contactColumn: uploadState.contactColumn,
      });
      setUploadState((current) => ({
        ...current,
        preview,
        batchName: current.batchName || preview.suggestedBatchName || '',
        contactColumn: current.contactColumn || preview.detectedContactColumn || '',
        removedColumns: [],
        addedColumns: [],
        status: `Preview ready. ${preview.totalRows} rows found.`,
      }));
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        status: error.response?.data?.message || 'Could not preview file',
      }));
    }
  };

  const handleImport = async () => {
    if (!uploadState.file || !uploadState.preview) {
      setUploadState((current) => ({ ...current, status: 'Preview the file before importing.' }));
      return;
    }

    try {
      setUploadState((current) => ({ ...current, status: 'Importing leads...' }));
      const response = await importLeadFile({
        product: selectedProduct,
        batchName: uploadState.batchName,
        file: uploadState.file,
        contactColumn: uploadState.contactColumn,
        removedColumns: uploadState.removedColumns,
        addedColumns: uploadState.addedColumns.filter((column) => column.name.trim()),
      });
      setUploadState({
        file: null,
        batchName: '',
        contactColumn: '',
        preview: null,
        removedColumns: [],
        addedColumns: [],
        status: `${response.summary.totalRows} leads imported into ${response.importBatch.batchName}.`,
      });
      setActionMessage('Import completed successfully.');
      await loadMetadata();
      await loadBatches();
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        status: error.response?.data?.message || 'Lead import failed',
      }));
    }
  };

  const toggleRemovedColumn = (header) => {
    setUploadState((current) => ({
      ...current,
      removedColumns: current.removedColumns.includes(header)
        ? current.removedColumns.filter((item) => item !== header)
        : [...current.removedColumns, header],
    }));
  };

  const updateAddedColumn = (index, field, value) => {
    setUploadState((current) => ({
      ...current,
      addedColumns: current.addedColumns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, [field]: value } : column
      ),
    }));
  };

  const addCustomColumn = () => {
    setUploadState((current) => ({
      ...current,
      addedColumns: [...current.addedColumns, createAddedColumn()],
    }));
  };

  const removeCustomColumn = (index) => {
    setUploadState((current) => ({
      ...current,
      addedColumns: current.addedColumns.filter((_, columnIndex) => columnIndex !== index),
    }));
  };

  const handleDeleteBatch = async (batch) => {
    const confirmed = window.confirm(
      `Delete dataset "${batch.batchName}"? This will remove its leads, assignments, and tracking data.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await deleteAnalystBatchApi(batch.importBatchId);
      setActionMessage(response.message);
      await loadBatches();
    } catch (error) {
      setActionMessage(error.response?.data?.message || 'Could not delete dataset');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading analyst workspace...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lead Upload</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload a file, name the batch, preview the contact column, then import it as a tracked batch.
            </p>
          </div>
          <Link
            to="/lead-settings"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Product Settings
          </Link>
        </div>

        <form onSubmit={handlePreview} className="mt-5 grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Product
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {products.map((product) => (
                <option key={product} value={product}>
                  {product.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            File
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  file: event.target.files?.[0] || null,
                  preview: null,
                  status: '',
                }))
              }
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Batch name
            <input
              type="text"
              value={uploadState.batchName}
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  batchName: event.target.value,
                }))
              }
              placeholder="Example: extrafreshleads"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Contact column override
            <input
              type="text"
              value={uploadState.contactColumn}
              onChange={(event) =>
                setUploadState((current) => ({
                  ...current,
                  contactColumn: event.target.value,
                }))
              }
              placeholder="Optional"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="lg:col-span-4">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Preview File
            </button>
          </div>
        </form>

        {uploadState.status && <p className="mt-4 text-sm text-slate-600">{uploadState.status}</p>}

        {uploadState.preview && (
          <div className="mt-6 space-y-6 rounded-2xl bg-slate-50 p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Detected contact column</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {uploadState.preview.detectedContactColumn || 'Not detected'}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Rows in file</div>
                <div className="mt-2 font-semibold text-slate-900">{uploadState.preview.totalRows}</div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Batch name</div>
                <div className="mt-2 font-semibold text-slate-900">{uploadState.batchName || 'Pending'}</div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">File</div>
                <div className="mt-2 font-semibold text-slate-900">{uploadState.preview.fileName}</div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Remove Uploaded Columns</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {uploadState.preview.headers.map((header) => {
                    const isContactColumn = header === uploadState.contactColumn;
                    return (
                      <label key={header} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={uploadState.removedColumns.includes(header)}
                          disabled={isContactColumn}
                          onChange={() => toggleRemovedColumn(header)}
                        />
                        <span className="text-sm text-slate-700">
                          {header}
                          {isContactColumn ? ' (contact column)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Add Custom Columns</h3>
                    <p className="mt-2 text-sm text-slate-600">Add new columns before import if this batch needs extra fields.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomColumn}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Column
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {uploadState.addedColumns.length === 0 && (
                    <p className="text-sm text-slate-500">No custom columns added yet.</p>
                  )}
                  {uploadState.addedColumns.map((column, index) => (
                    <div key={column.id} className="grid gap-3 lg:grid-cols-[1fr,1fr,auto]">
                      <input
                        type="text"
                        value={column.name}
                        onChange={(event) => updateAddedColumn(index, 'name', event.target.value)}
                        placeholder="Column name"
                        className="rounded-xl border border-slate-300 px-3 py-2"
                      />
                      <input
                        type="text"
                        value={column.defaultValue}
                        onChange={(event) => updateAddedColumn(index, 'defaultValue', event.target.value)}
                        placeholder="Default value"
                        className="rounded-xl border border-slate-300 px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomColumn(index)}
                        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Preview After Column Changes</h3>
                  <p className="mt-2 text-sm text-slate-600">This preview matches the batch sheet that will be stored after import.</p>
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Import Batch
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {visiblePreviewHeaders.map((header) => (
                        <th key={header} className="px-3 py-3 text-left font-semibold text-slate-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.map((row, index) => (
                      <tr key={index}>
                        {visiblePreviewHeaders.map((header) => (
                          <td key={header} className="px-3 py-3 text-slate-600">
                            {row[header] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Datasets</h2>
            <p className="mt-2 text-sm text-slate-600">
              Datasets are grouped by product first. Inside each product, open one dataset by its batch name.
            </p>
          </div>
        </div>

        {actionMessage && <p className="mt-4 text-sm text-slate-600">{actionMessage}</p>}

        <div className="mt-6 space-y-8">
          {groupedBatches.map(({ product, batches: productBatches }) => (
            <section key={product} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => toggleProductSection(product)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm"
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{product.toUpperCase()}</h3>
                  <p className="text-sm text-slate-500">{productBatches.length} datasets</p>
                </div>
                <span className="text-sm font-medium text-slate-500">
                  {openProducts[product] ? 'Hide' : 'Show'}
                </span>
              </button>

              {openProducts[product] && (
                <div className="mt-4">
                  {productBatches.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {productBatches.map((batch) => (
                        <div key={String(batch.importBatchId)} className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-semibold text-slate-900">{batch.batchName}</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={`/analyst-dash/${batch.importBatchId}`}
                                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                              >
                                Full Data
                              </Link>
                              <Link
                                to={`/analyst-dash/${batch.importBatchId}?view=assigned`}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Assigned
                              </Link>
                              <Link
                                to={`/analyst-dash/${batch.importBatchId}?view=unassigned`}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Unassigned
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(batch)}
                                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-slate-600">
                            <div>{batch.totalRows} total rows</div>
                            <div>{batch.assignedRows} assigned</div>
                            <div>{batch.unassignedRows} unassigned</div>
                            {batch.duplicateRows > 0 && (
                              <div className="font-medium text-amber-700">{batch.duplicateRows} duplicate rows</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                      No datasets imported for this product yet.
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AnalystDashboard;
