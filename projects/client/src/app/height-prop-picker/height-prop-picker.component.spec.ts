import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeightPropPickerComponent } from './height-prop-picker.component';

describe('HeightPropPickerComponent', () => {
  let component: HeightPropPickerComponent;
  let fixture: ComponentFixture<HeightPropPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeightPropPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeightPropPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
