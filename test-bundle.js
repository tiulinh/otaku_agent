import mod from './dist/index.js';

console.log('=== MODULE INSPECTION ===');
console.log('Module keys:', Object.keys(mod));
console.log('Has default:', 'default' in mod);

const project = mod.default || mod;
console.log('\n=== PROJECT ===');
console.log('Project keys:', Object.keys(project));
console.log('Agents count:', project.agents?.length);

if (project.agents?.[0]) {
  const agent = project.agents[0];
  console.log('\n=== AGENT ===');
  console.log('Agent character:', agent.character?.name);
  console.log('Plugins count:', agent.plugins?.length);

  const tmPlugin = agent.plugins?.find(p => p.name === 'plugin-token-metrics');
  console.log('\n=== TOKEN METRICS PLUGIN ===');
  console.log('Plugin found:', !!tmPlugin);
  console.log('Plugin name:', tmPlugin?.name);
  console.log('Services count:', tmPlugin?.services?.length);

  if (tmPlugin?.services?.[0]) {
    const ServiceClass = tmPlugin.services[0];
    console.log('\n=== SERVICE CLASS ===');
    console.log('Class name:', ServiceClass.name);
    console.log('serviceType:', ServiceClass.serviceType);
    console.log('start method exists:', typeof ServiceClass.start === 'function');
    console.log('start method:', ServiceClass.start.toString().substring(0, 200));
  }
}
