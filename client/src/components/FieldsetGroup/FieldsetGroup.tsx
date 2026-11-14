/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode, useState} from 'react';
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import {CollapsedPlaceholder, CollapseToggle} from "./parts";
import {fieldsetSx, legendSx} from "./styles";


type FieldsetGroupProps = {
    children: ReactNode;
    title: string;
    height?: string;
    style?: React.CSSProperties;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    fillAvailableSpace?: boolean;
};

export const FieldsetGroup = ({children, title, height, style, collapsible = false, defaultCollapsed = false, fillAvailableSpace = false}: FieldsetGroupProps) => {
    const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
    const isCollapsed = collapsible && collapsed;

    const toggle = () => setCollapsed(prev => !prev);

    return (
        <FormControl component="fieldset" sx={fieldsetSx({isCollapsed, fillAvailableSpace, height, style})}>
            <FormLabel component="legend" onClick={collapsible ? toggle : undefined} sx={legendSx({collapsible, isCollapsed})}>
                {title}
            </FormLabel>
            {collapsible && <CollapseToggle isCollapsed={isCollapsed} onToggle={toggle} />}
            {isCollapsed ? <CollapsedPlaceholder onExpand={toggle} /> : children}
        </FormControl>
    );
};
