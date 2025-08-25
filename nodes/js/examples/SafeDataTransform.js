/**
 * Example: Safe Data Transformation Node
 * 
 * This example shows how to create a safe data transformation
 * that operates within sandbox limits.
 */

// This code will be executed in the sandbox
function transform(inputs, params) {
  const { data } = inputs;
  const { operation = 'normalize' } = params;

  console.log(`Transforming ${data.length} records with operation: ${operation}`);

  switch (operation) {
    case 'normalize':
      return data.map(item => ({
        ...item,
        value: item.value / Math.max(...data.map(d => d.value))
      }));

    case 'filter':
      const threshold = params.threshold || 0;
      return data.filter(item => item.value > threshold);

    case 'aggregate':
      const groupBy = params.groupBy || 'category';
      const groups = {};
      
      data.forEach(item => {
        const key = item[groupBy];
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      return Object.entries(groups).map(([key, items]) => ({
        [groupBy]: key,
        count: items.length,
        totalValue: items.reduce((sum, item) => sum + item.value, 0),
        avgValue: items.reduce((sum, item) => sum + item.value, 0) / items.length
      }));

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Return the transformed data
return transform(inputs, params);