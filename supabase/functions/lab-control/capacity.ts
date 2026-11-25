// NextGen Lab Capacity Planner v309.3
// Provider-neutral sizing. No provider credentials or infrastructure actions live here.
export type LabProfile = { cpuRequest:number; memoryRequestGiB:number; storageGiB:number; cpuLimit:number; memoryLimitGiB:number };
export type CapacityInput = { students:number; concurrentPercent?:number; profile:LabProfile; nodeCpu:number; nodeMemoryGiB:number; nodeStorageGiB:number; systemCpuReserve?:number; systemMemoryReserveGiB?:number; storageReserveGiB?:number };
export function planCapacity(input:CapacityInput) {
  const {students,profile}=input;
  if(!Number.isInteger(students)||students<1||students>500) throw new Error('Student count must be between 1 and 500.');
  const pct=input.concurrentPercent??60;
  if(pct<10||pct>100) throw new Error('Concurrent percentage must be between 10 and 100.');
  const concurrent=Math.max(1,Math.ceil(students*pct/100));
  const cpuReserve=input.systemCpuReserve??2;
  const ramReserve=input.systemMemoryReserveGiB??4;
  const diskReserve=input.storageReserveGiB??20;
  const usableCpu=Math.max(0,input.nodeCpu-cpuReserve);
  const usableRam=Math.max(0,input.nodeMemoryGiB-ramReserve);
  const usableDisk=Math.max(0,input.nodeStorageGiB-diskReserve);
  const requestedCpu=concurrent*profile.cpuRequest;
  const requestedRamGiB=concurrent*profile.memoryRequestGiB;
  const requestedStorageGiB=students*profile.storageGiB;
  const fits=requestedCpu<=usableCpu && requestedRamGiB<=usableRamGiB && requestedStorageGiB<=usableDisk;
  return {students,concurrentStudents:concurrent,workspaceCount:students,requestedCpu,requestedRamGiB,requestedStorageGiB,usableCpu,usableRamGiB:usableRamGiB,usableStorageGiB:usableDisk,fits,recommendation:fits?'CURRENT_CAPACITY_SUFFICIENT':'ADDITIONAL_NODE_REQUIRED'};
}
