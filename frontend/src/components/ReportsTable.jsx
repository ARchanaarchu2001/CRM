import React from 'react';

export default function ReportsTable({ agentMetrics, reportTitle }) {
  if (!agentMetrics || agentMetrics.length === 0) {
    return <div className="text-center py-8 text-gray-500">No data available</div>;
  }

  // Calculate totals
  const totals = {
    agentName: 'Grand Total',
    numbersGiven: 0,
    numbersDialed: 0,
    reachable: 0,
    callback: 0,
    disconnectingCall: 0,
    dndo: 0,
    followUp: 0,
    invalidNumber: 0,
    noAnswer: 0,
    notInterested: 0,
    notReachable: 0,
    volTheOwner: 0,
    outOfCountry: 0,
    switchedOff: 0,
    tookService: 0,
  };

  agentMetrics.forEach((metric) => {
    totals.numbersGiven += metric.numbersGiven;
    totals.numbersDialed += metric.numbersDialed;
    totals.reachable += metric.reachable;
    totals.callback += metric.callback;
    totals.disconnectingCall += metric.disconnectingCall;
    totals.dndo += metric.dndo;
    totals.followUp += metric.followUp;
    totals.invalidNumber += metric.invalidNumber;
    totals.noAnswer += metric.noAnswer;
    totals.notInterested += metric.notInterested;
    totals.notReachable += metric.notReachable;
    totals.volTheOwner += metric.volTheOwner;
    totals.outOfCountry += metric.outOfCountry;
    totals.switchedOff += metric.switchedOff;
    totals.tookService += metric.tookService;
  });

  // Calculate reachable connectivity percent for totals
  totals.reachableConnectivityPercent = totals.numbersDialed > 0 
    ? Math.round((totals.reachable / totals.numbersDialed) * 100)
    : 0;

  return (
    <div className="mt-8 w-full overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{reportTitle}</h3>
      <table className="w-full border-collapse border border-gray-300 bg-white">
        <thead>
          <tr className="bg-blue-600 text-white sticky top-0">
            <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">Agent Name</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Numbers Given</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Numbers Dialed</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Reachable Connectivity %</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Call back</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Disconnecting call</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">DNDO</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Follow up</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Invalid number</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">No answer</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Not interested</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Not reachable</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Vol the owner</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Out of Country</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Switched off</th>
            <th className="border border-gray-300 px-3 py-2 text-center font-semibold whitespace-nowrap">Took Service</th>
          </tr>
        </thead>
        <tbody>
          {agentMetrics.map((metric, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="border border-gray-300 px-3 py-2 font-medium text-gray-800">{metric.agentName}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.numbersGiven}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.numbersDialed}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 bg-green-50">
                {metric.reachableConnectivityPercent}%
              </td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.callback}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.disconnectingCall}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.dndo}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.followUp}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.invalidNumber}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.noAnswer}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.notInterested}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.notReachable}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.volTheOwner}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.outOfCountry}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.switchedOff}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{metric.tookService}</td>
            </tr>
          ))}
          <tr className="bg-yellow-50 font-bold">
            <td className="border border-gray-300 px-3 py-2 font-bold text-gray-800">{totals.agentName}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.numbersGiven}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.numbersDialed}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 bg-green-100">
              {totals.reachableConnectivityPercent}%
            </td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.callback}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.disconnectingCall}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.dndo}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.followUp}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.invalidNumber}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.noAnswer}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.notInterested}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.notReachable}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.volTheOwner}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.outOfCountry}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.switchedOff}</td>
            <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800">{totals.tookService}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 text-sm text-gray-600">
        <p>Note: All metrics are aggregated from agent assignments for the selected period.</p>
      </div>
    </div>
  );
}
