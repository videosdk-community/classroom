import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { Classroom } from './screens/Classroom'
import type { ClassMode } from './fixtures/classroom'

/* Routes.

   Step 3 has one real screen. Mode is a query parameter here purely so both
   shapes can be looked at without a database behind them; in the shipped app
   mode is a room column, fixed at creation and read once at join from
   api/session.ts. There is no mid-class switch, so this switch is scaffolding
   and goes away in step 6. */

function ClassroomRoute() {
  const [params] = useSearchParams()
  const mode: ClassMode = params.get('mode') === 'lecture' ? 'lecture' : 'class'
  const showKeepout = params.get('keepout') === '1'

  return <Classroom mode={mode} showKeepout={showKeepout} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/room" element={<ClassroomRoute />} />
      <Route path="*" element={<Navigate to="/room" replace />} />
    </Routes>
  )
}
