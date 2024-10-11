
export const FunctionComponent = 0;
export const HostRoot = 3;
export const HostComponent = 5; // div
export const HostText = 6; // 23sdf23
export const Fragment = 7;

export type WorkTag = typeof FunctionComponent |
    typeof HostRoot |
    typeof HostComponent |
    typeof HostText |
    typeof Fragment;

export const WorkTagToName = {
    [HostRoot]: 'HostRoot',
    [HostComponent]: 'HostComponent',
    [FunctionComponent]: 'FunctionComponent',
    [Fragment]: 'Fragment',
    [HostText]: 'HostText'
}
