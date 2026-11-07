/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CSSProperties, useEffect, useRef, useState} from "react";
import {ThemeProvider, Tooltip} from "@mui/material";
import {AppleShortcuts, Minus, Plus, Sparks} from "iconoir-react";
import LayerIcon from "./assets/layer.svg";
import "./LayerSwitcher.scss";
import {darkTheme} from "../../../../utils";
import {useLayers} from "../../../../hooks/useLayers";
import {useLayerCommandState} from "../../../../hooks/useLayerCommandState";
import {LAYER_KIND, Layer} from "../../../../context/LayersContextBase";
import {ConfirmDialog} from "../../../ConfirmDialog";


/* Shows what the layer is doing for a command: running while it serves one, failed after the last
 * one failed, neutral otherwise. Work without a command behind it doesn't show yet.
 */
function LayerStatusDot ({layerId}: {layerId: string}) {
    const {status} = useLayerCommandState(layerId);

    return <span className="layer-switcher-status" data-status={status === "serving" ? "running" : status} aria-hidden="true" />;
}


// The toggle tooltip's fade in (MUI's default) and out; the layers start opening once the fade out ends.
const TOOLTIP_ENTER_MS = 200;
const TOOLTIP_EXIT_MS = 150;

type LayerNameEditorProps = {
    name: string;
    onCommit: (name: string) => void;
    onCancel: () => void;
};

function LayerNameEditor ({name, onCommit, onCancel}: LayerNameEditorProps) {
    const [value, setValue] = useState(name);
    // Some browsers fire blur as the input is removed: after Escape it must not commit after all.
    const isDoneRef = useRef(false);

    const finish = (done: () => void) => {
        if (isDoneRef.current) return;

        isDoneRef.current = true;
        done();
    };

    return (
        <input
            className="layer-switcher-name-input"
            aria-label="Layer name"
            value={value}
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => finish(() => onCommit(value))}
            onKeyDown={(event) => {
                if (event.key === "Enter") finish(() => onCommit(value));

                if (event.key === "Escape") finish(onCancel);
            }}
        />
    );
}

/* The stack on the right edge that shows one workflow layer at a time: the AI layer, then the
 * user's own layers, then a button to add one. The others keep running out of sight.
 */
export function LayerSwitcher () {
    const {layers, activeLayer, setActiveLayer, addLayer, deleteLayer, renameLayer, getLayerApi} = useLayers();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const pendingToggleRef = useRef<number | null>(null);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    // Kept after the dialog closes, so its message doesn't go blank while it fades out.
    const [layerToDelete, setLayerToDelete] = useState<Layer | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => () => {
        if (pendingToggleRef.current !== null) clearTimeout(pendingToggleRef.current);
    }, []);

    // A showing tooltip fades out first, and the layers open once it is gone: otherwise it would
    // hang in the air beside a toggle that has already glided away. Timed rather than hooked to the
    // transition's onExited, which would replace the one MUI needs to unmount the tooltip.
    const handleToggle = () => {
        // A second click while the first waits would undo it.
        if (pendingToggleRef.current !== null) return;

        if (!isTooltipOpen) {
            setIsExpanded(prev => !prev);

            return;
        }

        setIsTooltipOpen(false);
        pendingToggleRef.current = window.setTimeout(() => {
            pendingToggleRef.current = null;
            setIsExpanded(prev => !prev);
        }, TOOLTIP_EXIT_MS);
    };

    const handleDelete = (layer: Layer) => {
        // Only worth asking when there is a workflow to lose.
        if (getLayerApi(layer.id)?.hasNodes()) {
            setLayerToDelete(layer);
            setIsDeleteConfirmOpen(true);
        } else {
            deleteLayer(layer.id);
        }
    };

    const handleRename = (layer: Layer, name: string) => {
        renameLayer(layer.id, name);
        setEditingLayerId(null);
    };

    return (
        <>
            <div className="layer-switcher">
                {/* The nodes' theme, so this tooltip looks like theirs. */}
                <ThemeProvider theme={darkTheme}>
                    <Tooltip
                        title="Show Layers"
                        placement="left"
                        arrow
                        open={isTooltipOpen}
                        // Only while collapsed: once open, the layers explain themselves.
                        onOpen={() => {
                            if (!isExpanded) setIsTooltipOpen(true);
                        }}
                        onClose={() => setIsTooltipOpen(false)}
                        slotProps={{transition: {timeout: {enter: TOOLTIP_ENTER_MS, exit: TOOLTIP_EXIT_MS}}}}
                    >
                        <button
                            type="button"
                            className="layer-switcher-button layer-switcher-toggle"
                            aria-label={isExpanded ? "Hide layers" : "Show layers"}
                            aria-expanded={isExpanded}
                            onClick={handleToggle}
                        >
                            {/* Named after Apple's app, but drawn as the plain stacked-planes symbol for layers. */}
                            <AppleShortcuts />
                        </button>
                    </Tooltip>
                </ThemeProvider>
                {/* Mounted while collapsed too, so it can animate both ways; inert keeps it out of reach. */}
                <div className={`layer-switcher-layers${isExpanded ? " expanded" : ""}`} inert={!isExpanded}>
                    <div className="layer-switcher-layers-clip">
                        <div className="layer-switcher-layers-list">
                            {layers.map((layer, index) => {
                                const isUserLayer = layer.kind === LAYER_KIND.USER;
                                const isActive = layer.id === activeLayer.id;

                                return (
                                    <div
                                        key={layer.id}
                                        className={`layer-switcher-row${isActive ? " active" : ""}`}
                                        style={{"--row-index": index} as CSSProperties}
                                    >
                                        {editingLayerId === layer.id ? (
                                            <LayerNameEditor
                                                name={layer.name}
                                                onCommit={(name) => handleRename(layer, name)}
                                                onCancel={() => setEditingLayerId(null)}
                                            />
                                        ) : (
                                            <span
                                                className="layer-switcher-name"
                                                title={isUserLayer ? `${layer.name} (double-click to rename)` : layer.name}
                                                onClick={() => setActiveLayer(layer.id)}
                                                onDoubleClick={isUserLayer ? () => setEditingLayerId(layer.id) : undefined}
                                            >
                                                {layer.name}
                                            </span>
                                        )}
                                        <LayerStatusDot layerId={layer.id} />
                                        <button
                                            type="button"
                                            className="layer-switcher-button"
                                            aria-label={`Show ${layer.name}`}
                                            aria-pressed={isActive}
                                            onClick={() => setActiveLayer(layer.id)}
                                        >
                                            {isUserLayer ? <LayerIcon /> : <Sparks />}
                                        </button>
                                        {isUserLayer ? (
                                            <button
                                                type="button"
                                                className="layer-switcher-icon-button layer-switcher-delete"
                                                aria-label={`Delete ${layer.name}`}
                                                onClick={() => handleDelete(layer)}
                                            >
                                                <Minus />
                                            </button>
                                        ) : (
                                            <span className="layer-switcher-delete-placeholder" />
                                        )}
                                    </div>
                                );
                            })}
                            <div className="layer-switcher-row" style={{"--row-index": layers.length} as CSSProperties}>
                                <button
                                    type="button"
                                    className="layer-switcher-icon-button layer-switcher-add"
                                    aria-label="Add layer"
                                    onClick={() => addLayer()}
                                >
                                    <Plus />
                                </button>
                                <span className="layer-switcher-delete-placeholder" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmDialog
                open={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Delete Layer"
                message={`Delete "${layerToDelete?.name}"? Its workflow stops and is removed.`}
                confirmLabel="Delete"
                maximizable={false}
                onConfirm={() => {
                    if (layerToDelete) deleteLayer(layerToDelete.id);
                }}
            />
        </>
    );
}
