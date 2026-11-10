/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useMemo} from "react";
import {Autocomplete, Box, Checkbox, Chip, FormHelperText, TextField} from "@mui/material";
import {FieldsetGroup} from "../../../FieldsetGroup";
import {DebouncedTextField} from "../../../DebouncedTextField";
import {ALL_SEED_KEYS, SEED_COMPANIES, seedKeyOf} from "../seedCompanies";
import {isGroupSelected, SEED_GROUPS, seedCompaniesOf, toggleAll, toggleGroup} from "../utils/seedSelection";
import {JobSearchNodeData} from "../types/workflow";


type ChangeData = (data: Partial<JobSearchNodeData>) => void;

const COMPANIES_PLACEHOLDER = [
    "greenhouse:stripe",
    "lever:vercel",
    "ashby:linear",
    "workable:acme",
    "https://jobs.ashbyhq.com/ramp",
    "Some Company Name",
].join("\n");

function SelectionChip ({label, active, onClick}: {label: string; active: boolean; onClick: () => void}) {
    return <Chip label={label} size="small" color={active ? "primary" : "default"} variant={active ? "filled" : "outlined"} onClick={onClick} />;
}

// Picks the built-in companies all at once, none, or one ATS's.
function SeedChips ({selected, change}: {selected: string[]; change: ChangeData}) {
    const chosen = useMemo(() => new Set(selected), [selected]);

    return (
        <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mb: 1}}>
            <SelectionChip
                label={`Select all (${ALL_SEED_KEYS.length})`}
                active={isGroupSelected(chosen, ALL_SEED_KEYS)}
                onClick={() => change({seedCompanies: toggleAll(selected)})}
            />
            <SelectionChip label="Clear" active={selected.length === 0} onClick={() => change({seedCompanies: []})} />
            {SEED_GROUPS.map(({ats, keys}) => (
                <SelectionChip
                    key={ats}
                    label={`${ats} (${keys.length})`}
                    active={isGroupSelected(chosen, keys)}
                    onClick={() => change({seedCompanies: toggleGroup(selected, keys)})}
                />
            ))}
        </Box>
    );
}

function SeedPicker ({selected, change}: {selected: string[]; change: ChangeData}) {
    const value = useMemo(() => seedCompaniesOf(selected), [selected]);

    return (
        <Autocomplete
            multiple
            disableCloseOnSelect
            size="small"
            limitTags={6}
            options={SEED_COMPANIES}
            value={value}
            isOptionEqualToValue={(option, chosen) => seedKeyOf(option) === seedKeyOf(chosen)}
            getOptionLabel={option => option.token}
            groupBy={option => option.ats}
            onChange={(_, newValue) => change({seedCompanies: newValue.map(seedKeyOf)})}
            renderOption={(optionProps, option, {selected: isSelected}) => {
                const {key, ...rest} = optionProps as typeof optionProps & {key: string};

                return (
                    <li key={key} {...rest}>
                        <Checkbox checked={isSelected} size="small" sx={{mr: 1}} />
                        {option.token}
                    </li>
                );
            }}
            renderInput={params => (
                <TextField
                    {...params}
                    label={`Built-in companies (${selected.length}/${ALL_SEED_KEYS.length} selected)`}
                    placeholder="Search…"
                />
            )}
        />
    );
}

type CompanyFieldsProps = {
    companies: string;
    selected: string[];
    missing: boolean;
    fromUpstream: boolean | undefined;
    change: ChangeData;
};

/** The companies to search: typed ones, and ones picked from the built-in list. */
export function CompanyFields ({companies, selected, missing, fromUpstream, change}: CompanyFieldsProps) {
    return (
        <FieldsetGroup title={`Companies${missing ? " *" : ""}`}>
            <DebouncedTextField
                label="Companies (one per line)"
                variant="outlined"
                fullWidth
                multiline
                minRows={4}
                maxRows={12}
                placeholder={COMPANIES_PLACEHOLDER}
                value={companies}
                onChange={value => change({companies: value})}
                sx={{mb: 1}}
                disabled={fromUpstream}
            />
            <FormHelperText sx={{mb: 2}}>
                "ats:token", an ATS board link ("jobs.ashbyhq.com/…", "boards.greenhouse.io/…",
                "jobs.lever.co/…", "apply.workable.com/…" — not the company&apos;s own careers page), or a bare
                name (auto-located). ATSs: greenhouse, lever, ashby, workable (workable is rate-limited and may
                fail).
            </FormHelperText>
            <SeedChips selected={selected} change={change} />
            <SeedPicker selected={selected} change={change} />
        </FieldsetGroup>
    );
}
