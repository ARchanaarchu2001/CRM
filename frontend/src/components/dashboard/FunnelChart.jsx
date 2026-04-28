import React from 'react';
import { LuChevronRight } from 'react-icons/lu';

const FunnelChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div className="w-full py-6 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[600px] gap-2 px-4">
        {data.map((step, index) => {
          const heightPercentage = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
          // Calculate height to create a funnel effect (tall at start, shorter at end)
          const height = Math.max(heightPercentage, 20); 
          
          return (
            <React.Fragment key={index}>
              <div className="flex-1 flex flex-col items-center group">
                {/* Step Block */}
                <div 
                  className="w-full flex items-center justify-center relative transition-all duration-500 ease-out shadow-sm hover:shadow-md rounded-2xl overflow-hidden"
                  style={{ 
                    height: `${Math.max(height * 1.5, 60)}px`,
                    backgroundColor: step.color || '#4f46e5',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
                  
                  <div className="flex flex-col items-center z-10 text-white text-center px-2">
                    <span className="text-lg font-black leading-none mb-1">
                      {step.value.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-tight">
                      {step.label}
                    </span>
                  </div>

                  {/* Individual Conversion Badge */}
                  {index > 0 && data[index - 1].value > 0 && (
                    <div className="absolute top-0 left-0 bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded-br-lg">
                       <span className="text-[8px] font-black text-white">
                        {((step.value / data[index - 1].value) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Bottom label for small screens if needed, but here we use inner labels */}
              </div>

              {/* Arrow Connector */}
              {index < data.length - 1 && (
                <div className="flex-shrink-0 flex items-center text-slate-300">
                  <LuChevronRight className="text-xl animate-pulse" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelChart;
