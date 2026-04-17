import React, { useState } from 'react'
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
import { useMockData } from '../../context/MockDataContext'
import { AGENTS, FULLSCREEN_AGENT_MENUS, type FullscreenAgentMenuId } from '../../config/agentConfig'

interface NavigationProps {
  activeMenu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId
  onMenuChange: (menu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId) => void
}

export const Navigation: React.FC<NavigationProps> = ({ activeMenu, onMenuChange }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const drawerWidth = isExpanded ? 260 : 80
  const { useMock, toggleMock } = useMockData()

  const renderMenuButton = (
    menu: 'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId,
    label: string,
    icon: React.ReactNode,
    activeColor = '#1976d2',
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
          backgroundColor: activeMenu === menu ? '#e3f2fd' : 'transparent',
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
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #e0e0e0',
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
              color: '#1976d2',
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
            color: '#1976d2',
            flexShrink: 0,
          }}
        >
          {isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {/* Menu Items */}
      <Box sx={{ flex: 1, px: 1, py: 2 }}>
        {renderMenuButton('executive', 'Executive Dashboard', <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />)}

        {renderMenuButton('dashboard', 'Sample Dashboard', <DashboardIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, '#1976d2', true)}

        {isExpanded && (
          <Typography sx={{ px: 3, pt: 1.5, pb: 0.5, fontSize: '10px', fontWeight: 700, color: '#90a4ae', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Agents
          </Typography>
        )}
        {FULLSCREEN_AGENT_MENUS.map((item) => {
          const agent = AGENTS[item.agentId]
          return (
            <React.Fragment key={item.menuId}>
              {renderMenuButton(
                item.menuId,
                item.label,
                <Box component="img" src={agent.icon} alt={`${agent.name} icon`} sx={{ width: 20, height: 20, borderRadius: 1, objectFit: 'contain', display: 'block', flexShrink: 0 }} />,
                agent.color,
              )}
            </React.Fragment>
          )
        })}

        {renderMenuButton('quicksight-demo', 'QuickSight', <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, '#1976d2', true)}

        {renderMenuButton('preferences', 'Preferences', <TuneIcon sx={{ fontSize: '20px', flexShrink: 0 }} />, '#1976d2', true)}
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
            <DataObjectIcon sx={{ fontSize: 18, color: useMock ? '#f57c00' : '#9e9e9e' }} />
            {isExpanded && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: useMock ? '#f57c00' : '#777' }}>
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
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#f57c00' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#f57c00' },
              }}
            />
          )}
        </Box>
      </Tooltip>

    </Drawer>
  )
}
