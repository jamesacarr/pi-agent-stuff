import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

export type SessionUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
};

export const sumSessionUsage = (ctx: ExtensionCommandContext): SessionUsage => {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let totalCost = 0;

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== 'message') {
      continue;
    }

    const { message } = entry;
    if (message.role !== 'assistant') {
      continue;
    }

    const { usage } = message;
    input += usage.input;
    output += usage.output;
    cacheRead += usage.cacheRead;
    cacheWrite += usage.cacheWrite;
    totalCost += usage.cost.total;
  }

  return {
    cacheRead,
    cacheWrite,
    input,
    output,
    totalCost,
    totalTokens: input + output + cacheRead + cacheWrite,
  };
};
