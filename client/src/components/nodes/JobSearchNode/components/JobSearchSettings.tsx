/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {SxProps} from "@mui/material/styles";
import {Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText, InputLabel, MenuItem, Select, Switch} from "@mui/material";
import {BaseDialog} from "../../../BaseDialog";
import {FieldsetGroup} from "../../../FieldsetGroup";
import {CodeEditor} from "../../../CodeEditor";
import {DebouncedTextField} from "../../../DebouncedTextField";
import {DATE_POSTED_OPTIONS, DatePosted, EMPLOYMENT_TYPES, EmploymentType, JobSearchNodeData, SENIORITY_OPTIONS, Seniority} from "../types/workflow";
import {JOB_SEARCH_NODE_INPUT_JSON_SCHEMA} from "../types/input.types";
import {saveCountWithin} from "../../../../utils/countWithin";
import {toggle} from "../utils/seedSelection";
import {CompanyFields} from "./CompanyFields";
import "ace-builds/src-noconflict/mode-json";


type ChangeData = (data: Partial<JobSearchNodeData>) => void;
type SectionProps = {data: JobSearchNodeData; change: ChangeData};

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract / Freelance",
    internship: "Internship",
};

const DATE_LABELS: Record<DatePosted, string> = {
    any: "Any time",
    today: "Last 24 hours",
    "3days": "Last 3 days",
    week: "Last week",
    month: "Last month",
};

const SENIORITY_LABELS: Record<Seniority, string> = {
    any: "Any",
    junior: "Junior",
    mid: "Mid",
    senior: "Senior",
    lead: "Lead / Principal",
};

type LabeledSwitchProps = {label: string; checked: boolean | undefined; onChange: (checked: boolean) => void; sx?: SxProps};

function LabeledSwitch ({label, checked, onChange, sx = {m: 0}}: LabeledSwitchProps) {
    return (
        <FormControlLabel
            sx={sx}
            control={<Switch checked={checked || false} onChange={event => onChange(event.target.checked)} />}
            label={label}
            labelPlacement="start"
        />
    );
}

function InputFormat ({fromUpstream}: {fromUpstream: boolean | undefined}) {
    return (
        <FieldsetGroup title={`Expected Input Format ${fromUpstream ? "*" : "(when Provided by Upstream)"}`} height={"100%"} collapsible defaultCollapsed>
            <CodeEditor mode="json" value={JOB_SEARCH_NODE_INPUT_JSON_SCHEMA} readOnly={true} disabled={!fromUpstream} showLineNumbers={true} />
        </FieldsetGroup>
    );
}

function SearchSection ({keywords, data, change}: SectionProps & {keywords: string}) {
    return (
        <FieldsetGroup title="Search">
            <DebouncedTextField
                label="Keywords (title / department)"
                variant="outlined"
                fullWidth
                placeholder="full stack, full-stack, fullstack developer"
                value={keywords}
                onChange={value => change({keywords: value})}
                sx={{mb: 1}}
                disabled={data.dataProvidedByUpstream}
            />
            <FormHelperText sx={{mb: 2}}>
                Comma-separated phrases. A role matches when every word of a phrase appears in its
                title/department (any order). Shorter phrases match more broadly; no synonym guessing.
            </FormHelperText>
            <LabeledSwitch label="Remote only" checked={data.remoteOnly} onChange={checked => change({remoteOnly: checked})} />
        </FieldsetGroup>
    );
}

function FilterSection ({id, data, change}: SectionProps & {id: string}) {
    return (
        <FieldsetGroup title="Filters">
            <FormGroup sx={{mb: 1}}>
                {EMPLOYMENT_TYPES.map(type => (
                    <FormControlLabel
                        key={type}
                        control={<Checkbox checked={data.employmentTypes.includes(type)} onChange={() => change({employmentTypes: toggle(data.employmentTypes, type)})} />}
                        label={EMPLOYMENT_LABELS[type]}
                    />
                ))}
            </FormGroup>
            <FormControl fullWidth size="small" sx={{mb: 2}}>
                <InputLabel id={`${id}-date-label`}>Posted</InputLabel>
                <Select labelId={`${id}-date-label`} label="Posted" value={data.datePosted} onChange={event => change({datePosted: event.target.value})}>
                    {DATE_POSTED_OPTIONS.map(option => <MenuItem key={option} value={option}>{DATE_LABELS[option]}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl fullWidth size="small">
                <InputLabel id={`${id}-seniority-label`}>Seniority</InputLabel>
                <Select labelId={`${id}-seniority-label`} label="Seniority" value={data.seniority} onChange={event => change({seniority: event.target.value})}>
                    {SENIORITY_OPTIONS.map(option => <MenuItem key={option} value={option}>{SENIORITY_LABELS[option]}</MenuItem>)}
                </Select>
            </FormControl>
        </FieldsetGroup>
    );
}

function EligibilitySection ({candidateRegion, data, change}: SectionProps & {candidateRegion: string}) {
    return (
        <FieldsetGroup title="Work Eligibility">
            <DebouncedTextField
                label="Candidate region"
                variant="outlined"
                fullWidth
                value={candidateRegion}
                onChange={value => change({candidateRegion: value})}
                sx={{mb: 1}}
                disabled={data.dataProvidedByUpstream}
            />
            <FormHelperText sx={{mb: 1}}>
                Tags each job with whether its location text allows this region. ATS location data is free text,
                so it&apos;s best-effort.
            </FormHelperText>
            <LabeledSwitch
                label="Drop jobs that clearly exclude this region"
                checked={data.filterByEligibility}
                onChange={checked => change({filterByEligibility: checked})}
            />
        </FieldsetGroup>
    );
}

function LimitSection ({data, change}: SectionProps) {
    return (
        <FieldsetGroup title="Limits">
            <DebouncedTextField
                label="Max companies per run"
                type="number"
                variant="outlined"
                fullWidth
                value={data.maxCompanies}
                onChange={value => saveCountWithin(value, 1, 400, count => change({maxCompanies: count}))}
                sx={{mb: 2}}
            />
            <DebouncedTextField
                label="Max results"
                type="number"
                variant="outlined"
                fullWidth
                value={data.resultsLimit}
                onChange={value => saveCountWithin(value, 1, 500, count => change({resultsLimit: count}))}
            />
        </FieldsetGroup>
    );
}

type JobSearchSettingsProps = SectionProps & {
    open: boolean;
    onClose: () => void;
    id: string;
    title: string;
    /** Companies, keywords and region as the next search uses them. */
    fields: Pick<JobSearchNodeData, "companies" | "keywords" | "candidateRegion">;
    missingCompanies: boolean;
};

/** The Job Search node's settings dialog. */
export function JobSearchSettings ({open, onClose, id, title, data, fields, missingCompanies, change}: JobSearchSettingsProps) {
    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <InputFormat fromUpstream={data.dataProvidedByUpstream} />
            <LabeledSwitch
                label="Provided by Upstream"
                sx={{m: 0, mb: 2}}
                checked={data.dataProvidedByUpstream}
                onChange={checked => change({dataProvidedByUpstream: checked})}
            />
            <CompanyFields
                companies={fields.companies}
                selected={data.seedCompanies}
                missing={missingCompanies}
                fromUpstream={data.dataProvidedByUpstream}
                change={change}
            />
            <SearchSection keywords={fields.keywords} data={data} change={change} />
            <FilterSection id={id} data={data} change={change} />
            <EligibilitySection candidateRegion={fields.candidateRegion} data={data} change={change} />
            <LimitSection data={data} change={change} />
        </BaseDialog>
    );
}
