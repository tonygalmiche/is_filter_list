# -*- coding: utf-8 -*-

#TODO:
#- Pour les dates pouvoir faire des plages de dates. >=2020 et <=2025
#- Pour les autres champs pouvoir mettre des virgules pour indiquer plusieurs valeur
#- mettre des * devant, derrière ou au milieu pour préciser contient ou commence par ou finir par



{
  "name" : "InfoSaône - Vue Liste avec filtre Odoo 18",
  "version" : "0.1.0",
  "author" : "InfoSaône / Tony Galmiche",
  "category" : "InfoSaône",
  "description": """
InfoSaône - Vue Liste avec filtre Odoo 18
""",
  "maintainer": "InfoSaône",
  "website": "http://www.infosaone.com",
  "depends" : [
    'base',
    'web',
    'account',
  ], 
  "init_xml" : [],            
  "demo_xml" : [
  ],            
  "data" : [
    'security/ir.model.access.csv',
    'views/res_users_views.xml',
    'views/res_partner_views.xml',
    'views/account_move_views.xml',
    'views/is_filter_list_mem_var_views.xml',
  ],   
   'assets': {
        'web.assets_backend': [
            'is_filter_list/static/src/views/filter_list/filter_list.xml',
            'is_filter_list/static/src/views/filter_list/filter_list_controller.js',
            'is_filter_list/static/src/views/filter_list/filter_list_renderer.js',
            'is_filter_list/static/src/views/filter_list/filter_list_view.js',
        ],
    },
  "installable": True,         
  "active": False,            
  "application": True,
  "license": "AGPL-3",
}


