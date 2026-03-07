import { Registry } from './types';

export const defaultRegistry = (): Registry => ({
  version: 1,
  agents: {
    default: {
      id: 'default',
      systemPrompt: 'You are a helpful coding agent.',
      defaultModel: 'gpt-4.1-mini',
      behaviorTags: ['safe', 'general'],
    },
  },
  skills: {},
  mcps: {},
  permissions: {
    safe: {
      id: 'safe',
      shell: 'confirm',
      fileRead: 'allow',
      fileWrite: 'confirm',
      network: 'confirm',
      git: 'confirm',
      browserHttp: 'confirm',
      secretAccess: 'deny',
      processExecution: 'confirm',
      mcpInvocation: 'confirm',
      locked: false,
    },
  },
  commands: {},
  profiles: {
    personal: {
      id: 'personal',
    },
    work: {
      id: 'work',
      overrides: {
        permissions: {
          safe: {
            id: 'safe',
            network: 'deny',
            secretAccess: 'deny',
            locked: true,
          },
        },
      },
    },
  },
  presets: {},
  workspaceOverrides: {},
});
