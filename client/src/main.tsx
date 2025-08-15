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


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <SettingsProvider>
            <App />
        </SettingsProvider>
    </StrictMode>
)
