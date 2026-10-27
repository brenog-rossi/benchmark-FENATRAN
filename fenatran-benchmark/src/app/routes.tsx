import type { ReactNode } from 'react'
import { EvaluationEditor, FinalizeConfirm, TypeChoice } from '../features/evaluation'
import { ExportFlow } from '../features/export'
import { EvaluationList, HomeWelcome } from '../features/home'
import { EditProfile, ProfileGate } from '../features/onboarding'
import { TwoPane } from './AppShell'

// List pane is always visible on wide screens; on phones only the active pane shows.
function Workspace({ detail, active }: { detail: ReactNode; active: 'list' | 'detail' }) {
  return (
    <ProfileGate>
      <TwoPane list={<EvaluationList />} detail={detail} active={active} />
    </ProfileGate>
  )
}

export const routes = [
  { path: '/', element: <Workspace active="list" detail={<HomeWelcome />} /> },
  { path: '/new', element: <Workspace active="detail" detail={<TypeChoice />} /> },
  { path: '/evaluation/:id', element: <Workspace active="detail" detail={<EvaluationEditor />} /> },
  {
    path: '/evaluation/:id/confirm',
    element: <Workspace active="detail" detail={<FinalizeConfirm />} />,
  },
  { path: '/export', element: <Workspace active="detail" detail={<ExportFlow />} /> },
  {
    path: '/profile',
    element: (
      <ProfileGate>
        <EditProfile />
      </ProfileGate>
    ),
  },
]
