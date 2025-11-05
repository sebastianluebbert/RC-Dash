import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const proxmoxControlSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  vmid: z.number().int().positive().max(999999999),
  type: z.enum(['qemu', 'lxc']),
  action: z.enum(['start', 'stop', 'shutdown', 'reboot']),
});

export const proxmoxCreateVMSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  vmid: z.number().int().positive().max(999999999),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_.]+$/),
  cores: z.number().int().positive().max(128).optional(),
  memory: z.number().int().positive().max(1048576).optional(),
  disk: z.number().int().positive().max(10485760).optional(),
  ostype: z.string().max(50).optional(),
});

export const proxmoxCreateLXCSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  vmid: z.number().int().positive().max(999999999),
  hostname: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_.]+$/),
  ostemplate: z.string().min(1).max(200),
  cores: z.number().int().positive().max(128).optional(),
  memory: z.number().int().positive().max(1048576).optional(),
  swap: z.number().int().nonnegative().max(1048576).optional(),
  disk: z.number().int().positive().max(10485760).optional(),
  rootfs: z.string().max(100).optional(),
  password: z.string().min(8).max(128).optional(),
});

export const vncTicketSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  vmid: z.number().int().positive().max(999999999),
  type: z.enum(['qemu', 'lxc']).optional(),
});
