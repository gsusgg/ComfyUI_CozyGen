import React from 'react';

const WorkflowSelector = ({ workflows, selectedWorkflow, onSelect }) => {
  return (
    <div className="bg-base-200 shadow-lg rounded-lg p-4">
      <label htmlFor="workflow-selector" className="block text-lg font-semibold text-white mb-2">
        Workflow
      </label>
      <select
        id="workflow-selector"
        className="block w-full p-3 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
        value={selectedWorkflow || ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>-- Select a workflow --</option>
        {workflows.map((wf) => (
          <option key={wf} value={wf}>
            {wf}
          </option>
        ))}
      </select>
    </div>
  );
};

export default WorkflowSelector;
