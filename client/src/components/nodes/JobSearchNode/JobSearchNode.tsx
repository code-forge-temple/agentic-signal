/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useMemo, useState} from "react";
import {
    Autocomplete,
    Box,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
} from "@mui/material";
import {
    assertIsJobSearchNodeData,
    DATE_POSTED_OPTIONS,
    DatePosted,
    EMPLOYMENT_TYPES,
    EmploymentType,
    SENIORITY_OPTIONS,
    Seniority,
} from "./types/workflow";
import {JOB_SEARCH_NODE_INPUT_JSON_SCHEMA} from "./types/input.types";
import {JobSearchService} from "./services/jobSearchService";
import {ALL_SEED_KEYS, SEED_COMPANIES, SeedCompany, seedKeyOf} from "./seedCompanies";
import {BaseNode} from "../BaseNode";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {FieldsetGroup} from "../../FieldsetGroup";
import {CodeEditor} from "../../CodeEditor";
import {DebouncedTextField} from "../../DebouncedTextField";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {useLatestValue} from "../../../hooks/useLatestValue";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {getField} from "../../../utils";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import "ace-builds/src-noconflict/mode-json";


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

const COMPANIES_PLACEHOLDER = [
    "greenhouse:stripe",
    "lever:vercel",
    "ashby:linear",
    "workable:acme",
    "https://jobs.ashbyhq.com/ramp",
    "Some Company Name",
].join("\n");

const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
    Math.max(lo, Math.min(hi, Number(v) || fallback));

const SEED_BY_KEY = new Map(SEED_COMPANIES.map(c => [seedKeyOf(c), c]));
const ATS_LIST = ["greenhouse", "lever", "ashby", "workable"] as const;
const SEED_KEYS_BY_ATS: Record<string, string[]> = Object.fromEntries(
    ATS_LIST.map(ats => [ats, SEED_COMPANIES.filter(c => c.ats === ats).map(seedKeyOf)])
);

export function JobSearchNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsJobSearchNodeData(data);

    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);

    const {
        input, title, companies, seedCompanies, keywords, remoteOnly, employmentTypes,
        datePosted, seniority, candidateRegion, filterByEligibility, maxCompanies,
        resultsLimit, dataProvidedByUpstream, onResultUpdate, onConfigChange,
    } = data;

    const dataProvidedByUpstreamRef = useLatestValue(dataProvidedByUpstream);
    const openSettingsRef = useLatestValue(openSettings);

    const selectedSeed = useMemo(
        () => seedCompanies.map(k => SEED_BY_KEY.get(k)).filter((c): c is SeedCompany => Boolean(c)),
        [seedCompanies]
    );

    const seedSet = useMemo(() => new Set(seedCompanies), [seedCompanies]);
    const isAllSeedSelected = ALL_SEED_KEYS.every(k => seedSet.has(k));
    const isNoSeedSelected = seedSet.size === 0;

    const forwardToolsPayload = useCallback(
        () => (input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {}),
        [input]
    );

    const upstream = dataProvidedByUpstream ? input?.payload : undefined;
    const mergedCompanies: string = getField(upstream, "companies", companies);
    const mergedKeywords: string = getField(upstream, "keywords", keywords);
    const mergedRegion: string = getField(upstream, "candidateRegion", candidateRegion);

    const runSearch = useCallback(async () => {
        setError(null);
        onResultUpdate(id);

        const up = dataProvidedByUpstreamRef.current ? input?.payload : undefined;
        const cos: string = getField(up, "companies", companies);
        const kw: string = getField(up, "keywords", keywords);
        const region: string = getField(up, "candidateRegion", candidateRegion);

        if (seedCompanies.length === 0 && !cos.trim()) {
            setError("Add at least one company, or select some from the built-in list, in the node settings.");
            onResultUpdate(id);

            return;
        }

        runTask(async () => {
            try {
                const result = await JobSearchService.search({
                    companies: cos,
                    seedCompanies,
                    keywords: kw,
                    remoteOnly,
                    employmentTypes,
                    datePosted,
                    seniority,
                    candidateRegion: region,
                    filterByEligibility,
                    maxCompanies,
                    resultsLimit,
                });

                onResultUpdate(id, {payload: result, ...forwardToolsPayload()});
            } catch (err) {
                setError(`Job search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                onResultUpdate(id);
            }
        }, setIsRunning);
    }, [
        id, input, companies, keywords, candidateRegion, seedCompanies, remoteOnly,
        employmentTypes, datePosted, seniority, filterByEligibility, maxCompanies,
        resultsLimit, onResultUpdate, forwardToolsPayload, dataProvidedByUpstreamRef,
    ]);

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => onResultUpdate(id),
        runCallback: () => {
            if (dataProvidedByUpstreamRef.current && !openSettingsRef.current) {
                runSearch();
            }
        },
    }, [input]);

    useTimerTrigger(input?.timerTrigger, runSearch);

    const hasMissingConfig = seedCompanies.length === 0 && !mergedCompanies?.trim();

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{input: true, output: true}}
                extraPorts={<TimerTriggerPort />}
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                run={runSearch}
                running={isRunning}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <FieldsetGroup
                    title={`Expected Input Format ${dataProvidedByUpstream ? "*" : "(when Provided by Upstream)"}`}
                    height={"100%"}
                    collapsible
                    defaultCollapsed
                >
                    <CodeEditor
                        mode="json"
                        value={JOB_SEARCH_NODE_INPUT_JSON_SCHEMA}
                        readOnly={true}
                        disabled={!dataProvidedByUpstream}
                        showLineNumbers={true}
                    />
                </FieldsetGroup>

                <FormControlLabel
                    sx={{m: 0, mb: 2}}
                    control={
                        <Switch
                            checked={dataProvidedByUpstream || false}
                            onChange={e => onConfigChange(id, {dataProvidedByUpstream: e.target.checked})}
                        />
                    }
                    label="Provided by Upstream"
                    labelPlacement="start"
                />

                <FieldsetGroup title={`Companies${hasMissingConfig ? " *" : ""}`}>
                    <DebouncedTextField
                        label="Companies (one per line)"
                        variant="outlined"
                        fullWidth
                        multiline
                        minRows={4}
                        maxRows={12}
                        placeholder={COMPANIES_PLACEHOLDER}
                        value={mergedCompanies}
                        onChange={value => onConfigChange(id, {companies: value})}
                        sx={{mb: 1}}
                        disabled={dataProvidedByUpstream}
                    />
                    <FormHelperText sx={{mb: 2}}>
                        "ats:token", an ATS board link ("jobs.ashbyhq.com/…", "boards.greenhouse.io/…",
                        "jobs.lever.co/…", "apply.workable.com/…" — not the company&apos;s own careers page), or a bare
                        name (auto-located). ATSs: greenhouse, lever, ashby, workable (workable is rate-limited and may
                        fail).
                    </FormHelperText>

                    <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mb: 1}}>
                        <Chip
                            label={`Select all (${ALL_SEED_KEYS.length})`}
                            size="small"
                            color={isAllSeedSelected ? "primary" : "default"}
                            variant={isAllSeedSelected ? "filled" : "outlined"}
                            onClick={() => onConfigChange(id, {seedCompanies: isAllSeedSelected ? [] : ALL_SEED_KEYS})}
                        />
                        <Chip
                            label="Clear"
                            size="small"
                            color={isNoSeedSelected ? "primary" : "default"}
                            variant={isNoSeedSelected ? "filled" : "outlined"}
                            onClick={() => onConfigChange(id, {seedCompanies: []})}
                        />
                        {ATS_LIST.filter(ats => SEED_KEYS_BY_ATS[ats].length > 0).map(ats => {
                            const keys = SEED_KEYS_BY_ATS[ats];
                            const active = keys.every(k => seedSet.has(k));

                            return (
                                <Chip
                                    key={ats}
                                    label={`${ats} (${keys.length})`}
                                    size="small"
                                    color={active ? "primary" : "default"}
                                    variant={active ? "filled" : "outlined"}
                                    onClick={() => onConfigChange(id, {
                                        seedCompanies: active
                                            ? seedCompanies.filter(k => !keys.includes(k))
                                            : [...new Set([...seedCompanies, ...keys])],
                                    })}
                                />
                            );
                        })}
                    </Box>
                    <Autocomplete
                        multiple
                        disableCloseOnSelect
                        size="small"
                        limitTags={6}
                        options={SEED_COMPANIES}
                        value={selectedSeed}
                        isOptionEqualToValue={(option, value) => seedKeyOf(option) === seedKeyOf(value)}
                        getOptionLabel={option => option.token}
                        groupBy={option => option.ats}
                        onChange={(_, newValue) => onConfigChange(id, {seedCompanies: newValue.map(seedKeyOf)})}
                        renderOption={(optionProps, option, {selected}) => {
                            const {key, ...rest} = optionProps as typeof optionProps & {key: string};

                            return (
                                <li key={key} {...rest}>
                                    <Checkbox checked={selected} size="small" sx={{mr: 1}} />
                                    {option.token}
                                </li>
                            );
                        }}
                        renderInput={params => (
                            <TextField
                                {...params}
                                label={`Built-in companies (${seedCompanies.length}/${ALL_SEED_KEYS.length} selected)`}
                                placeholder="Search…"
                            />
                        )}
                    />
                </FieldsetGroup>

                <FieldsetGroup title="Search">
                    <DebouncedTextField
                        label="Keywords (title / department)"
                        variant="outlined"
                        fullWidth
                        placeholder="full stack, full-stack, fullstack developer"
                        value={mergedKeywords}
                        onChange={value => onConfigChange(id, {keywords: value})}
                        sx={{mb: 1}}
                        disabled={dataProvidedByUpstream}
                    />
                    <FormHelperText sx={{mb: 2}}>
                        Comma-separated phrases. A role matches when every word of a phrase appears in its
                        title/department (any order). Shorter phrases match more broadly; no synonym guessing.
                    </FormHelperText>
                    <FormControlLabel
                        sx={{m: 0}}
                        control={
                            <Switch
                                checked={remoteOnly || false}
                                onChange={e => onConfigChange(id, {remoteOnly: e.target.checked})}
                            />
                        }
                        label="Remote only"
                        labelPlacement="start"
                    />
                </FieldsetGroup>

                <FieldsetGroup title="Filters">
                    <FormGroup sx={{mb: 1}}>
                        {EMPLOYMENT_TYPES.map(t => (
                            <FormControlLabel
                                key={t}
                                control={
                                    <Checkbox
                                        checked={employmentTypes.includes(t)}
                                        onChange={() => onConfigChange(id, {employmentTypes: toggle(employmentTypes, t)})}
                                    />
                                }
                                label={EMPLOYMENT_LABELS[t]}
                            />
                        ))}
                    </FormGroup>
                    <FormControl fullWidth size="small" sx={{mb: 2}}>
                        <InputLabel id={`${id}-date-label`}>Posted</InputLabel>
                        <Select
                            labelId={`${id}-date-label`}
                            label="Posted"
                            value={datePosted}
                            onChange={e => onConfigChange(id, {datePosted: e.target.value})}
                        >
                            {DATE_POSTED_OPTIONS.map(d => (
                                <MenuItem key={d} value={d}>{DATE_LABELS[d]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel id={`${id}-seniority-label`}>Seniority</InputLabel>
                        <Select
                            labelId={`${id}-seniority-label`}
                            label="Seniority"
                            value={seniority}
                            onChange={e => onConfigChange(id, {seniority: e.target.value})}
                        >
                            {SENIORITY_OPTIONS.map(s => (
                                <MenuItem key={s} value={s}>{SENIORITY_LABELS[s]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </FieldsetGroup>

                <FieldsetGroup title="Work Eligibility">
                    <DebouncedTextField
                        label="Candidate region"
                        variant="outlined"
                        fullWidth
                        value={mergedRegion}
                        onChange={value => onConfigChange(id, {candidateRegion: value})}
                        sx={{mb: 1}}
                        disabled={dataProvidedByUpstream}
                    />
                    <FormHelperText sx={{mb: 1}}>
                        Tags each job with whether its location text allows this region. ATS location data is free text,
                        so it&apos;s best-effort.
                    </FormHelperText>
                    <FormControlLabel
                        sx={{m: 0}}
                        control={
                            <Switch
                                checked={filterByEligibility || false}
                                onChange={e => onConfigChange(id, {filterByEligibility: e.target.checked})}
                            />
                        }
                        label="Drop jobs that clearly exclude this region"
                        labelPlacement="start"
                    />
                </FieldsetGroup>

                <FieldsetGroup title="Limits">
                    <DebouncedTextField
                        label="Max companies per run"
                        type="number"
                        variant="outlined"
                        fullWidth
                        value={maxCompanies}
                        onChange={value => onConfigChange(id, {maxCompanies: clamp(value, 1, 400, 60)})}
                        sx={{mb: 2}}
                    />
                    <DebouncedTextField
                        label="Max results"
                        type="number"
                        variant="outlined"
                        fullWidth
                        value={resultsLimit}
                        onChange={value => onConfigChange(id, {resultsLimit: clamp(value, 1, 500, 100)})}
                    />
                </FieldsetGroup>
            </BaseDialog>
        </>
    );
}
