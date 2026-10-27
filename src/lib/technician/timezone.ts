import { formatDateTime, organizationDateKey } from "../timezone";
export function formatOrganizationDateTime(value:string,timeZone:string){return formatDateTime(value,timeZone);}
export { organizationDateKey };
export function classifyTechnicianJob(scheduled:string|null,status:string,timeZone:string,now=new Date()){if(status==="completed")return"completed" as const;if(!scheduled)return"unscheduled" as const;const job=organizationDateKey(scheduled,timeZone),today=organizationDateKey(now,timeZone);return job===today?"today" as const:job>today?"upcoming" as const:"past" as const;}
