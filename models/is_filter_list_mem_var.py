from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class IsFilterListMemVar(models.Model):
    _name = 'is.filter.list.mem.var'
    _description = 'Filter List Memory Variable'

    view_id = fields.Many2one('ir.ui.view', string='View', required=True, ondelete='cascade')
    model_id = fields.Many2one('ir.model', string='Model', required=True, ondelete='cascade')
    field_id = fields.Many2one('ir.model.fields', string='Field', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', string='User', required=True, default=lambda self: self.env.user, ondelete='cascade')
    value = fields.Char(string='Value')

    _sql_constraints = [
        ('unique_filter', 'unique(view_id, model_id, field_id, user_id)', 'A filter for this view, model, field and user already exists.')
    ]

    @api.model
    def set_filter_value(self, view_id, model_name, field_name, value):
        """
        Save or update the filter value for the current user.
        If value is empty, delete the record.
        """
        if not view_id:
            return False
        try:
            view_id = int(view_id)
        except (ValueError, TypeError):
            _logger.warning(f"Invalid view_id: {view_id}")
            return False

        # Use sudo to ensure access to system models
        IrModel = self.env['ir.model'].sudo()
        IrModelField = self.env['ir.model.fields'].sudo()

        # Find model_id
        model = IrModel.search([('model', '=', model_name)], limit=1)
        if not model:
            _logger.warning(f"Model {model_name} not found")
            return False

        # Find field_id
        field = IrModelField.search([('model_id', '=', model.id), ('name', '=', field_name)], limit=1)
        if not field:
            # This can happen for dynamic fields or related fields not in ir.model.field
            # We just ignore saving for these fields to avoid errors
            return False
            
        # Find existing record
        domain = [
            ('view_id', '=', view_id),
            ('model_id', '=', model.id),
            ('field_id', '=', field.id),
            ('user_id', '=', self.env.user.id)
        ]
        record = self.search(domain, limit=1)

        if not value:
            if record:
                record.unlink()
            return True

        if record:
            record.value = value
        else:
            self.create({
                'view_id': view_id,
                'model_id': model.id,
                'field_id': field.id,
                'user_id': self.env.user.id,
                'value': value
            })
        return True

    @api.model
    def get_filter_values(self, view_id, model_name):
        """
        Retrieve all saved filters for the current user, view and model.
        Returns a dictionary {field_name: value}
        """
        if not view_id:
            return {}
        try:
            view_id = int(view_id)
        except (ValueError, TypeError):
            return {}

        IrModel = self.env['ir.model'].sudo()
        model = IrModel.search([('model', '=', model_name)], limit=1)
        if not model:
            return {}

        domain = [
            ('view_id', '=', view_id),
            ('model_id', '=', model.id),
            ('user_id', '=', self.env.user.id)
        ]
        records = self.search(domain)
        
        return {rec.field_id.name: rec.value for rec in records}
