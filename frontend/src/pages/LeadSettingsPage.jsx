import React, { useEffect, useState } from 'react';
import { fetchLeadMetadata, updateRemarkConfig } from '../api/leads.js';

const createInitialRemarkState = (configs = []) =>
  configs.reduce((accumulator, config) => {
    accumulator[config.product] = {
      contactabilityStatuses: (config.contactabilityStatuses || []).join('\n'),
      callAttempt1Label: config.callAttempt1Label || 'Call Attempt 1 - Date',
      callAttempt2Label: config.callAttempt2Label || 'Call Attempt 2 - Date',
      callingRemarkLabel: config.callingRemarkLabel || 'Calling Remarks',
      interestedRemarkLabel: config.interestedRemarkLabel || 'Interested Remarks',
      notInterestedRemarkLabel: config.notInterestedRemarkLabel || 'Not Interested Remarks',
      callingRemarks: (config.callingRemarks || []).join('\n'),
      interestedRemarks: (config.interestedRemarks || []).join('\n'),
      notInterestedRemarks: (config.notInterestedRemarks || []).join('\n'),
    };
    return accumulator;
  }, {});

const LeadSettingsPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('p2p');
  const [remarkState, setRemarkState] = useState({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        const data = await fetchLeadMetadata();
        setProducts(data.products || []);
        setRemarkState(createInitialRemarkState(data.remarkConfigs || []));
        setSelectedProduct(data.products?.[0] || 'p2p');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const currentRemarkConfig = remarkState[selectedProduct] || {
    contactabilityStatuses: '',
    callAttempt1Label: 'Call Attempt 1 - Date',
    callAttempt2Label: 'Call Attempt 2 - Date',
    callingRemarkLabel: 'Calling Remarks',
    interestedRemarkLabel: 'Interested Remarks',
    notInterestedRemarkLabel: 'Not Interested Remarks',
    callingRemarks: '',
    interestedRemarks: '',
    notInterestedRemarks: '',
  };

  const handleSave = async () => {
    try {
      const response = await updateRemarkConfig(selectedProduct, {
        contactabilityStatuses: currentRemarkConfig.contactabilityStatuses.split('\n'),
        callAttempt1Label: currentRemarkConfig.callAttempt1Label,
        callAttempt2Label: currentRemarkConfig.callAttempt2Label,
        callingRemarkLabel: currentRemarkConfig.callingRemarkLabel,
        interestedRemarkLabel: currentRemarkConfig.interestedRemarkLabel,
        notInterestedRemarkLabel: currentRemarkConfig.notInterestedRemarkLabel,
        callingRemarks: currentRemarkConfig.callingRemarks.split('\n'),
        interestedRemarks: currentRemarkConfig.interestedRemarks.split('\n'),
        notInterestedRemarks: currentRemarkConfig.notInterestedRemarks.split('\n'),
      });
      setRemarkState((current) => ({
        ...current,
        [selectedProduct]: {
          contactabilityStatuses: response.remarkConfig.contactabilityStatuses.join('\n'),
          callAttempt1Label: response.remarkConfig.callAttempt1Label,
          callAttempt2Label: response.remarkConfig.callAttempt2Label,
          callingRemarkLabel: response.remarkConfig.callingRemarkLabel,
          interestedRemarkLabel: response.remarkConfig.interestedRemarkLabel,
          notInterestedRemarkLabel: response.remarkConfig.notInterestedRemarkLabel,
          callingRemarks: response.remarkConfig.callingRemarks.join('\n'),
          interestedRemarks: response.remarkConfig.interestedRemarks.join('\n'),
          notInterestedRemarks: response.remarkConfig.notInterestedRemarks.join('\n'),
        },
      }));
      setMessage(`Saved remark options for ${selectedProduct.toUpperCase()}.`);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save remark options');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading lead settings...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lead Settings</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage product-specific remark options here. Agents will only be able to select from these lists.
            </p>
          </div>
          <select
            value={selectedProduct}
            onChange={(event) => setSelectedProduct(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {products.map((product) => (
              <option key={product} value={product}>
                {product.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="text-sm font-medium text-slate-700">
            Contactability status options
            <textarea
              rows="4"
              value={currentRemarkConfig.contactabilityStatuses}
              onChange={(event) =>
                setRemarkState((current) => ({
                  ...current,
                  [selectedProduct]: {
                    ...currentRemarkConfig,
                    contactabilityStatuses: event.target.value,
                  },
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Call attempt 1 label
              <input
                type="text"
                value={currentRemarkConfig.callAttempt1Label}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      callAttempt1Label: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Call attempt 2 label
              <input
                type="text"
                value={currentRemarkConfig.callAttempt2Label}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      callAttempt2Label: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Calling remark label
              <input
                type="text"
                value={currentRemarkConfig.callingRemarkLabel}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      callingRemarkLabel: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Interested remark label
              <input
                type="text"
                value={currentRemarkConfig.interestedRemarkLabel}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      interestedRemarkLabel: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Not interested remark label
              <input
                type="text"
                value={currentRemarkConfig.notInterestedRemarkLabel}
                onChange={(event) =>
                  setRemarkState((current) => ({
                    ...current,
                    [selectedProduct]: {
                      ...currentRemarkConfig,
                      notInterestedRemarkLabel: event.target.value,
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Calling remarks
            <textarea
              rows="8"
              value={currentRemarkConfig.callingRemarks}
              onChange={(event) =>
                setRemarkState((current) => ({
                  ...current,
                  [selectedProduct]: {
                    ...currentRemarkConfig,
                    callingRemarks: event.target.value,
                  },
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Interested remarks
            <textarea
              rows="6"
              value={currentRemarkConfig.interestedRemarks}
              onChange={(event) =>
                setRemarkState((current) => ({
                  ...current,
                  [selectedProduct]: {
                    ...currentRemarkConfig,
                    interestedRemarks: event.target.value,
                  },
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Not interested remarks
            <textarea
              rows="5"
              value={currentRemarkConfig.notInterestedRemarks}
              onChange={(event) =>
                setRemarkState((current) => ({
                  ...current,
                  [selectedProduct]: {
                    ...currentRemarkConfig,
                    notInterestedRemarks: event.target.value,
                  },
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="w-fit rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Save Product Remarks
          </button>

          {message && <p className="text-sm text-slate-600">{message}</p>}
        </div>
      </section>
    </div>
  );
};

export default LeadSettingsPage;
