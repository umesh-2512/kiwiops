import { jobStatuses,type JobStatus } from "./types";
export const JOB_PAGE_SIZE=20; type Raw=Record<string,string|string[]|undefined>; const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export const normalizeJobSearch=(v:string|string[]|undefined)=>(first(v)??"").trim().replace(/[,%()]/g," ").replace(/\s+/g," ").slice(0,100);
export function parseJobListParams(raw:Raw){const page=Number.parseInt(first(raw.page)??"1",10);const status=first(raw.status);return{page:Number.isSafeInteger(page)&&page>0?page:1,query:normalizeJobSearch(raw.q),status:(jobStatuses as readonly string[]).includes(status??"")?status as JobStatus:"all" as const};}
export function jobListHref(p:{page?:number;query?:string;status?:JobStatus|"all"}){const s=new URLSearchParams();if(p.query)s.set("q",p.query);if(p.status&&p.status!=="all")s.set("status",p.status);if(p.page&&p.page>1)s.set("page",String(p.page));return s.size?`/jobs?${s}`:"/jobs";}
