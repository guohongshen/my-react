import { FiberRootNode } from "./fiber";

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(...lanes: Lane[]) {
    let merge = 0;
    if (lanes && lanes.length > 0) {
        lanes.forEach(lane => {
            merge = merge | lane;
        });
    }
    return merge;
}

export function requestUpdateLane() {
    return SyncLane;
}

export function getHighestPriorityLane(lanes: Lanes) {
    return lanes & -lanes;
}

export function markFiberFinished(
    root: FiberRootNode,
    lane: Lane
) {
    root.pendingLanes &= ~lane;
}
