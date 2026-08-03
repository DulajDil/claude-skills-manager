import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/hooks/useTheme'
import { SkillsPage } from '@/pages/SkillsPage'
import { SkillDetailPage } from '@/pages/SkillDetailPage'
import { EditSkillPage } from '@/pages/EditSkillPage'
import { MarketplacePage } from '@/pages/MarketplacePage'
import { StarterPage } from '@/pages/StarterPage'
import { UsagePage } from '@/pages/UsagePage'
import { AgentsPage } from '@/pages/AgentsPage'
import { AgentFormPage } from '@/pages/AgentFormPage'
import { AgentFlowPage } from '@/pages/AgentFlowPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SkillsPage />} />
          <Route path="/skills/:id" element={<SkillDetailPage />} />
          <Route path="/skills/:id/edit" element={<EditSkillPage />} />
          <Route path="/starter" element={<StarterPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/new" element={<AgentFormPage />} />
          <Route path="/agents/:id" element={<AgentFlowPage />} />
          <Route path="/agents/:id/edit" element={<AgentFormPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  )
}
