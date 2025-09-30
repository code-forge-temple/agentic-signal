/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {App} from './components/App'
import {SettingsProvider} from './context/SettingsContext'
import {SnackbarProvider} from 'notistack'


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
            <SettingsProvider>
                <App />
            </SettingsProvider>
        </SnackbarProvider>
    </StrictMode>
)
