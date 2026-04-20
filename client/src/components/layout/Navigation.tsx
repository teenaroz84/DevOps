import React, { useEffect, useState } from 'react'
import {
  Box,
  Drawer,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Switch,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import TuneIcon from '@mui/icons-material/Tune'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DataObjectIcon from '@mui/icons-material/DataObject'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMockData } from '../../context/MockDataContext'
import { AGENTS, FULLSCREEN_AGENT_MENUS, type FullscreenAgentMenuId } from '../../config/agentConfig'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'

const AGENTS_FOUNDRY_STORAGE_KEY = 'agents-foundry-expanded'

interface NavigationProps {
  activeMenu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId
  onMenuChange: (menu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId) => void
}

export const Navigation: React.FC<NavigationProps> = ({ activeMenu, onMenuChange }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isAgentsFoundryExpanded, setIsAgentsFoundryExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(AGENTS_FOUNDRY_STORAGE_KEY) === 'true'
  })
  const drawerWidth = isExpanded ? 260 : 80
  const { useMock, toggleMock } = useMockData()

  useEffect(() => {
    window.localStorage.setItem(AGENTS_FOUNDRY_STORAGE_KEY, String(isAgentsFoundryExpanded))
  }, [isAgentsFoundryExpanded])

  const renderMenuButton = (
    menu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId,
    label: string,
    icon: React.ReactNode,
    activeColor: string = APP_COLORS.primary,
    hidden = false,
  ) => (
    <Tooltip title={!isExpanded ? label : ''} placement="right">
      <Box
        component="button"
        onClick={() => onMenuChange(menu)}
        sx={{
          width: isExpanded ? 'calc(100% - 24px)' : 'calc(100% - 24px)',
          display: hidden ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: isExpanded ? 2 : 0,
          padding: '12px 16px',
          margin: '8px 12px',
          borderRadius: 1,
          border: 'none',
          backgroundColor: activeMenu === menu ? TRUIST.shell : 'transparent',
          color: activeMenu === menu ? activeColor : '#666',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: '#f5f5f5',
            color: activeColor,
          },
        }}
      >
        {icon}
        {isExpanded && (
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: activeMenu === menu ? 600 : 500,
              color: 'inherit',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    </Tooltip>
  )

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: APP_COLORS.panelAlt,
          borderRight: `1px solid ${APP_COLORS.border}`,
          transition: 'width 0.3s ease',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      {/* Logo and Toggle Section */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        {isExpanded && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: APP_COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            📊 DataOps
          </Typography>
        )}
        <IconButton
          onClick={() => setIsExpanded(!isExpanded)}
          size="small"
          sx={{
            marginLeft: 'auto',
            color: APP_COLORS.primary,
            flexShrink: 0,
          }}
        >
          {isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {/* Menu Items */}
      <Box sx={{ flex: 1, px: 1, py: 2 }}>
        {renderMenuButton('executive', 'Executive Dashboard', <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />)}

        {renderMenuButton('dashboard', 'Sample Dashboard', <DashboardIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, APP_COLORS.primary, true)}

        {isExpanded && (
          <Box
            component="button"
            type="button"
            onClick={() => setIsAgentsFoundryExpanded(!isAgentsFoundryExpanded)}
            sx={{
              width: 'calc(100% - 24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '8px 12px 0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: 1,
              backgroundColor: 'transparent',
              color: '#90a4ae',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#eceff1',
                color: '#607d8b',
              },
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Agents Foundry
            </Typography>
            {isAgentsFoundryExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </Box>
        )}
        {isExpanded && isAgentsFoundryExpanded && FULLSCREEN_AGENT_MENUS.map((item) => {
          const agent = AGENTS[item.agentId]
          return (
            <React.Fragment key={item.menuId}>
              {renderMenuButton(
                item.menuId,
                item.label,
                <Box component="img" src={agent.icon} alt={`${agent.name} icon`} sx={{ width: '20%', height: '20%', minWidth: 28, minHeight: 28, borderRadius: 1, objectFit: 'contain', display: 'block', flexShrink: 0 }} />,
                agent.color,
              )}
            </React.Fragment>
          )
        })}

        {renderMenuButton('quicksight-demo', 'QuickSight', <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, APP_COLORS.primary, true)}

        {renderMenuButton('preferences', 'Preferences', <TuneIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, APP_COLORS.primary, true)}
      </Box>

      {/* Mock Data Toggle */}
      <Divider sx={{ my: 1 }} />
      <Tooltip title={useMock ? 'Switch to Live API data' : 'Switch to Mock data'} placement="right">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            px: isExpanded ? 2 : 0,
            py: 0.75,
            cursor: 'pointer',
            '&:hover': { bgcolor: '#f0f4ff' },
          }}
          onClick={toggleMock}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DataObjectIcon sx={{ fontSize: 18, color: useMock ? TRUIST.purple : TRUIST.midGray }} />
            {isExpanded && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: useMock ? TRUIST.purple : TRUIST.darkGray }}>
                {useMock ? 'Mock Data' : 'Live Data'}
              </Typography>
            )}
          </Box>
          {isExpanded && (
            <Switch
              checked={useMock}
              onChange={toggleMock}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: TRUIST.purple },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: TRUIST.purple },
              }}
            />
          )}
        </Box>
      </Tooltip>

    </Drawer>
  )
}
