import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BrainCircuit, Zap } from 'lucide-react';

const CustomFlowNode: React.FC<NodeProps> = ({ data, selected }) => {
  const isStartNode = data.label.toLowerCase() === 'start';

  // Base classes
  const baseClasses = "flex items-center p-4 rounded-lg shadow-md transition-all duration-200 w-[200px] h-[80px] border-2";

  // State-dependent classes
  const stateClasses = selected
    ? "bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300"
    : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-lg";

  const iconClasses = selected ? "text-indigo-600" : "text-slate-400";

  return (
    <div className={`${baseClasses} ${stateClasses}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <div className="flex-shrink-0 mr-4">
        {isStartNode ? (
          <Zap size={24} className={iconClasses} />
        ) : (
          <BrainCircuit size={24} className={iconClasses} />
        )}
      </div>
      <div className="flex-1">
        <div className="font-bold text-slate-800 text-sm">{data.label}</div>
        {data.subtext && <div className="text-xs text-slate-500 mt-1">{data.subtext}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  );
};

export default CustomFlowNode;