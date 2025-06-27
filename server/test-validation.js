const { updateVulnerabilitySchema } = require('vnlu-shared');

// 测试数据 - 模拟实际请求中的null值
const testData = {
  title: "敏感信息泄露",
  description: "敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露敏感信息泄露",
  severity: "CRITICAL",
  codeSnippet: '{\n  "name": "vulnerability-management-platform"\n}',
  affectedSystem: null,
  reproductionSteps: null,
  impact: "123",
  recommendation: null
};

console.log('Testing validation with data:', JSON.stringify(testData, null, 2));

try {
  const result = updateVulnerabilitySchema.parse(testData);
  console.log('Validation passed:', result);
} catch (error) {
  console.error('Validation failed:', error.errors);
}